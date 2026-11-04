import logging
import secrets
import threading
from django.utils import timezone
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from accounts.models import AuditLog
from accounts.permissions import require_permission
from accounts.email_service import (
    send_newsletter_verification_email,
    send_promotional_campaign_email
)
from .models import Notification, NewsletterSubscriber, PromotionalCampaign, CampaignDeliveryLog
from .serializers import (
    NotificationSerializer,
    NewsletterSubscriberSerializer,
    PromotionalCampaignSerializer,
    CampaignDeliveryLogSerializer
)

logger = logging.getLogger(__name__)


# ============================================================================
# NOTIFICATIONS
# ============================================================================

class NotificationListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        base_qs = Notification.objects.filter(user=request.user)
        unread_count = base_qs.filter(is_read=False).count()

        # Category Counts
        counts = {
            'all': base_qs.count(),
            'unread': unread_count,
            'low_stock': base_qs.filter(
                notification_type__in=[Notification.NotificationType.LOW_STOCK, Notification.NotificationType.STOCK_ALERT]
            ).count(),
            'out_of_stock': base_qs.filter(
                notification_type=Notification.NotificationType.OUT_OF_STOCK
            ).count(),
            'supplier_email_sent': base_qs.filter(
                notification_type=Notification.NotificationType.SUPPLIER_EMAIL_SENT
            ).count(),
            'supplier_email_failed': base_qs.filter(
                notification_type=Notification.NotificationType.SUPPLIER_EMAIL_FAILED
            ).count(),
        }

        # Filtering
        filter_type = (request.query_params.get('filter') or request.query_params.get('type') or 'all').strip().lower()
        filtered_qs = base_qs

        if filter_type in ('low_stock', 'low-stock'):
            filtered_qs = base_qs.filter(
                notification_type__in=[Notification.NotificationType.LOW_STOCK, Notification.NotificationType.STOCK_ALERT]
            )
        elif filter_type in ('out_of_stock', 'out-of-stock'):
            filtered_qs = base_qs.filter(notification_type=Notification.NotificationType.OUT_OF_STOCK)
        elif filter_type in ('supplier_email_sent', 'email_sent', 'supplier-email-sent'):
            filtered_qs = base_qs.filter(notification_type=Notification.NotificationType.SUPPLIER_EMAIL_SENT)
        elif filter_type in ('supplier_email_failed', 'email_failed', 'supplier-email-failed'):
            filtered_qs = base_qs.filter(notification_type=Notification.NotificationType.SUPPLIER_EMAIL_FAILED)

        limit = int(request.query_params.get('limit', 100))
        serializer = NotificationSerializer(filtered_qs[:limit], many=True)
        return Response({
            'unread_count': unread_count,
            'counts': counts,
            'notifications': serializer.data
        })

    def post(self, request):
        Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({'message': 'All notifications marked as read.'})

    def delete(self, request):
        Notification.objects.filter(user=request.user).delete()
        return Response({'message': 'All notifications cleared.'}, status=status.HTTP_200_OK)


class NotificationMarkReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        try:
            notif = Notification.objects.get(id=pk, user=request.user)
            notif.is_read = True
            notif.save()
            return Response(NotificationSerializer(notif).data)
        except Notification.DoesNotExist:
            return Response({'error': 'Notification not found.'}, status=status.HTTP_404_NOT_FOUND)


class NotificationDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pk):
        try:
            notif = Notification.objects.get(id=pk, user=request.user)
            notif.delete()
            return Response({'message': 'Notification removed successfully.'}, status=status.HTTP_200_OK)
        except Notification.DoesNotExist:
            return Response({'error': 'Notification not found.'}, status=status.HTTP_404_NOT_FOUND)


# ============================================================================
# NEWSLETTER SUBSCRIPTION & DOUBLE OPT-IN
# ============================================================================

class NewsletterSubscribeView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = (request.data.get('email') or '').strip().lower()
        if not email:
            return Response({'error': 'Email address is required.'}, status=status.HTTP_400_BAD_REQUEST)

        from accounts.validators import validate_email_address
        try:
            email = validate_email_address(email, required=True)
        except serializers.ValidationError as err:
            err_msg = err.detail[0] if isinstance(err.detail, list) else str(err.detail)
            return Response({'error': err_msg}, status=status.HTTP_400_BAD_REQUEST)

        subscriber, created = NewsletterSubscriber.objects.get_or_create(
            email=email,
            defaults={
                'verification_token': secrets.token_urlsafe(32),
                'unsubscribe_token': secrets.token_urlsafe(32),
                'is_verified': False,
                'is_active': True,
                'ip_address': request.META.get('REMOTE_ADDR')
            }
        )

        if not created:
            if subscriber.is_verified and subscriber.is_active:
                return Response({
                    'message': 'You are already actively subscribed to our newsletter.',
                    'already_subscribed': True
                })
            elif subscriber.is_verified and not subscriber.is_active:
                subscriber.is_active = True
                subscriber.unsubscribed_at = None
                subscriber.save()
                return Response({
                    'message': 'Welcome back! Your newsletter subscription has been reactivated.',
                    'reactivated': True
                })
            else:
                # Re-issue verification token and resend email
                subscriber.verification_token = secrets.token_urlsafe(32)
                subscriber.is_active = True
                subscriber.save()

        # Send double opt-in verification email
        send_newsletter_verification_email(subscriber)

        return Response({
            'message': 'A verification email has been sent. Please confirm your subscription from your inbox.',
            'email': email
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class NewsletterVerifyView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        token = request.query_params.get('token')
        return self._verify(token)

    def post(self, request):
        token = request.data.get('token')
        return self._verify(token)

    def _verify(self, token):
        if not token:
            return Response({'error': 'Verification token is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            subscriber = NewsletterSubscriber.objects.get(verification_token=token)
        except NewsletterSubscriber.DoesNotExist:
            return Response({'error': 'Invalid or expired newsletter verification token.'}, status=status.HTTP_400_BAD_REQUEST)

        subscriber.is_verified = True
        subscriber.is_active = True
        subscriber.verified_at = timezone.now()
        subscriber.save()

        return Response({
            'message': 'Your email has been verified! You are now subscribed to EthioTech Market promotions.',
            'email': subscriber.email
        })


class NewsletterUnsubscribeView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        token = request.data.get('token') or request.query_params.get('token')
        email = (request.data.get('email') or '').strip().lower()

        subscriber = None
        if token:
            subscriber = NewsletterSubscriber.objects.filter(unsubscribe_token=token).first()
        elif email:
            subscriber = NewsletterSubscriber.objects.filter(email=email).first()
        elif request.user.is_authenticated:
            subscriber = NewsletterSubscriber.objects.filter(email=request.user.email.lower()).first()

        if not subscriber:
            return Response({'error': 'Subscriber not found or token invalid.'}, status=status.HTTP_404_NOT_FOUND)

        subscriber.is_active = False
        subscriber.unsubscribed_at = timezone.now()
        subscriber.save()

        return Response({
            'message': 'You have been successfully unsubscribed from promotional marketing emails.',
            'email': subscriber.email
        })


class NewsletterStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        subscriber = NewsletterSubscriber.objects.filter(email=request.user.email.lower()).first()
        return Response({
            'is_subscribed': bool(subscriber and subscriber.is_active and subscriber.is_verified),
            'is_verified': bool(subscriber and subscriber.is_verified),
            'is_active': bool(subscriber and subscriber.is_active),
            'email': request.user.email
        })

    def post(self, request):
        """Toggle or update subscription for customer profile."""
        subscribe = request.data.get('subscribe', True)
        email = request.user.email.lower()

        subscriber, created = NewsletterSubscriber.objects.get_or_create(
            email=email,
            defaults={
                'verification_token': secrets.token_urlsafe(32),
                'unsubscribe_token': secrets.token_urlsafe(32),
                'is_verified': request.user.email_verified,
                'is_active': subscribe,
                'verified_at': timezone.now() if request.user.email_verified else None
            }
        )

        if not created:
            subscriber.is_active = subscribe
            if not subscriber.is_verified and request.user.email_verified:
                subscriber.is_verified = True
                subscriber.verified_at = timezone.now()
            if not subscribe:
                subscriber.unsubscribed_at = timezone.now()
            else:
                subscriber.unsubscribed_at = None
            subscriber.save()

        return Response({
            'message': 'Newsletter preferences updated successfully.',
            'is_subscribed': subscriber.is_active and subscriber.is_verified
        })


# ============================================================================
# ADMIN PROMOTIONAL CAMPAIGNS MANAGEMENT
# ============================================================================

class NewsletterSubscriberListView(generics.ListAPIView):
    queryset = NewsletterSubscriber.objects.all()
    serializer_class = NewsletterSubscriberSerializer
    permission_classes = [require_permission('promotions.manage')]

    def get_queryset(self):
        qs = super().get_queryset()
        is_verified = self.request.query_params.get('is_verified')
        is_active = self.request.query_params.get('is_active')
        search = (self.request.query_params.get('search') or '').strip()

        if is_verified is not None:
            qs = qs.filter(is_verified=is_verified.lower() == 'true')
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == 'true')
        if search:
            qs = qs.filter(email__icontains=search)
        return qs


class PromotionalCampaignListCreateView(generics.ListCreateAPIView):
    queryset = PromotionalCampaign.objects.all()
    serializer_class = PromotionalCampaignSerializer
    permission_classes = [require_permission('promotions.manage')]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class PromotionalCampaignDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = PromotionalCampaign.objects.all()
    serializer_class = PromotionalCampaignSerializer
    permission_classes = [require_permission('promotions.manage')]


class PromotionalCampaignPreviewView(APIView):
    permission_classes = [require_permission('promotions.manage')]

    def post(self, request, pk):
        try:
            campaign = PromotionalCampaign.objects.get(id=pk)
        except PromotionalCampaign.DoesNotExist:
            return Response({'error': 'Campaign not found.'}, status=status.HTTP_404_NOT_FOUND)

        target_email = request.data.get('email') or request.user.email
        if not target_email:
            return Response({'error': 'Target preview email is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Mock subscriber for preview
        dummy_subscriber = NewsletterSubscriber(
            email=target_email,
            unsubscribe_token='preview-dummy-token',
            is_verified=True,
            is_active=True
        )

        try:
            send_promotional_campaign_email(campaign, dummy_subscriber)
            return Response({'message': f"Preview email sent to {target_email}."})
        except Exception as e:
            return Response({'error': f"Failed to send preview: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def _dispatch_campaign_worker(campaign_id, admin_user_id):
    try:
        from accounts.models import User
        campaign = PromotionalCampaign.objects.get(id=campaign_id)
        subscribers = NewsletterSubscriber.objects.filter(is_active=True, is_verified=True)
        delivered = 0
        failed = 0

        for sub in subscribers:
            try:
                send_promotional_campaign_email(campaign, sub)
                CampaignDeliveryLog.objects.create(
                    campaign=campaign,
                    subscriber=sub,
                    status=CampaignDeliveryLog.Status.SENT
                )
                delivered += 1
            except Exception as e:
                CampaignDeliveryLog.objects.create(
                    campaign=campaign,
                    subscriber=sub,
                    status=CampaignDeliveryLog.Status.FAILED,
                    error_message=str(e)
                )
                failed += 1

        campaign.delivered_count = delivered
        campaign.failed_count = failed
        campaign.status = PromotionalCampaign.Status.SENT if delivered > 0 else PromotionalCampaign.Status.FAILED
        campaign.save()

        try:
            admin_user = User.objects.get(id=admin_user_id)
            AuditLog.objects.create(
                user=admin_user,
                action="PROMOTIONAL_CAMPAIGN_DISPATCHED",
                details=f"Campaign '{campaign.title}' sent: {delivered} delivered, {failed} failed."
            )
        except Exception:
            pass

    except Exception as e:
        logger.exception(f"Error during promotional campaign dispatch: {e}")


class PromotionalCampaignSendView(APIView):
    permission_classes = [require_permission('promotions.manage')]

    def post(self, request, pk):
        try:
            campaign = PromotionalCampaign.objects.get(id=pk)
        except PromotionalCampaign.DoesNotExist:
            return Response({'error': 'Campaign not found.'}, status=status.HTTP_404_NOT_FOUND)

        if campaign.status == PromotionalCampaign.Status.SENT:
            return Response({'error': 'This campaign has already been sent to subscribers.'}, status=status.HTTP_400_BAD_REQUEST)

        subscribers = NewsletterSubscriber.objects.filter(is_active=True, is_verified=True)
        count = subscribers.count()

        if count == 0:
            return Response({
                'error': 'No active, verified subscribers found. Cannot send campaign.'
            }, status=status.HTTP_400_BAD_REQUEST)

        campaign.status = PromotionalCampaign.Status.SENDING
        campaign.sent_at = timezone.now()
        campaign.recipient_count = count
        campaign.save()

        # Run bulk campaign dispatch in background thread
        thread = threading.Thread(
            target=_dispatch_campaign_worker,
            args=(campaign.id, request.user.id),
            daemon=True
        )
        thread.start()

        return Response({
            'message': f"Promotional campaign dispatch initiated for {count} verified active subscribers.",
            'recipient_count': count,
            'campaign': PromotionalCampaignSerializer(campaign).data
        })
