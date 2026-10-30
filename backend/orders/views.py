import logging
import hmac
import hashlib
from decimal import Decimal
from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import transaction
from django.db.models import Sum, Q
from django.utils import timezone
from django.conf import settings
from .models import (
    Cart, CartItem, Order, OrderItem, PaymentEvidence,
    Receipt, WarrantyClaim, OrderStatusHistory
)
from .serializers import (
    CartSerializer, CartItemSerializer,
    OrderSerializer, PaymentEvidenceSerializer, ReceiptSerializer,
    WarrantyClaimSerializer, OrderStatusHistorySerializer
)
from .chapa import ChapaService
from products.models import Product, StockMovement
from accounts.permissions import IsStoreManagerOrAdmin, IsNotAdmin, require_permission
from accounts.models import User, AuditLog
from notifications.models import Notification, create_order_notification
from recommendations.models import CustomerActivity

logger = logging.getLogger(__name__)


class CartView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsNotAdmin]

    def get(self, request):
        if request.user.role == User.Role.ADMIN:
            return Response(
                {'error': 'Administrators are restricted from personal shopping and cart operations.'},
                status=status.HTTP_403_FORBIDDEN
            )
        cart, _ = Cart.objects.get_or_create(user=request.user)
        return Response(CartSerializer(cart).data)

    def post(self, request):
        # Prevent administrators from adding items to cart
        if request.user.role == User.Role.ADMIN:
            return Response(
                {'error': 'Administrators are restricted from adding products to the shopping cart. Please use a customer account for personal purchases.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Add item to cart
        cart, _ = Cart.objects.get_or_create(user=request.user)
        product_id = request.data.get('product_id')
        quantity = int(request.data.get('quantity', 1))

        try:
            product = Product.objects.get(id=product_id, is_active=True)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)

        if product.stock < quantity:
            return Response({'error': f"Only {product.stock} units available in stock."}, status=status.HTTP_400_BAD_REQUEST)

        cart_item, created = CartItem.objects.get_or_create(cart=cart, product=product)
        if not created:
            if product.stock < (cart_item.quantity + quantity):
                return Response({'error': f"Cannot add more than {product.stock} items to cart."}, status=status.HTTP_400_BAD_REQUEST)
            cart_item.quantity += quantity
        else:
            cart_item.quantity = quantity
        cart_item.save()

        # Log add to cart activity for AI
        try:
            CustomerActivity.objects.create(
                user=request.user,
                product=product,
                activity_type=CustomerActivity.ActivityType.ADD_TO_CART
            )
        except Exception:
            pass

        return Response(CartSerializer(cart).data)

    def put(self, request):
        if request.user.role == User.Role.ADMIN:
            return Response(
                {'error': 'Administrators are restricted from modifying shopping cart items.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Update item quantity
        cart, _ = Cart.objects.get_or_create(user=request.user)
        item_id = request.data.get('item_id')
        quantity = int(request.data.get('quantity', 1))

        try:
            item = CartItem.objects.get(id=item_id, cart=cart)
        except CartItem.DoesNotExist:
            return Response({'error': 'Cart item not found.'}, status=status.HTTP_404_NOT_FOUND)

        if quantity <= 0:
            item.delete()
        else:
            if item.product.stock < quantity:
                return Response({'error': f"Only {item.product.stock} units available in stock."}, status=status.HTTP_400_BAD_REQUEST)
            item.quantity = quantity
            item.save()

        return Response(CartSerializer(cart).data)

    def delete(self, request):
        if request.user.role == User.Role.ADMIN:
            return Response(
                {'error': 'Administrators are restricted from cart operations.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Remove item or clear cart
        cart, _ = Cart.objects.get_or_create(user=request.user)
        item_id = request.data.get('item_id')
        if item_id:
            CartItem.objects.filter(id=item_id, cart=cart).delete()
        else:
            cart.items.all().delete()
        return Response(CartSerializer(cart).data)


class CheckoutView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsNotAdmin]

    @transaction.atomic
    def post(self, request):
        if request.user.role == User.Role.ADMIN:
            return Response(
                {'error': 'Administrators are restricted from personal shopping checkout. Please use a customer account to place orders.'},
                status=status.HTTP_403_FORBIDDEN
            )

        cart, _ = Cart.objects.get_or_create(user=request.user)
        cart_items = cart.items.select_related('product').all()

        if not cart_items.exists():
            return Response({'error': 'Your cart is empty.'}, status=status.HTTP_400_BAD_REQUEST)

        # Shipping details
        shipping_name = request.data.get('shipping_name') or f"{request.user.first_name} {request.user.last_name}".strip() or request.user.username
        shipping_phone = request.data.get('shipping_phone') or getattr(request.user, 'phone_number', '') or ''
        shipping_address = request.data.get('shipping_address') or getattr(request.user, 'address', '') or ''
        shipping_city = request.data.get('shipping_city') or getattr(request.user, 'city', '') or 'Addis Ababa'
        notes = request.data.get('notes', '')
        payment_method = request.data.get('payment_method', 'CHAPA').upper()
        if payment_method not in ['CHAPA', 'MANUAL_BANK']:
            payment_method = 'CHAPA'

        if not shipping_phone or not shipping_address:
            return Response({'error': 'Shipping phone and address are required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Validate stock for all items and calculate authoritative server price
        subtotal = Decimal('0.00')
        for item in cart_items:
            if item.product.stock < item.quantity:
                return Response({
                    'error': f"Product '{item.product.name}' only has {item.product.stock} units left in stock."
                }, status=status.HTTP_400_BAD_REQUEST)
            unit_price = Decimal(str(item.product.current_price))
            subtotal += (unit_price * item.quantity)

        # Dynamic delivery method calculation
        delivery_method = request.data.get('delivery_method', 'standard')
        DELIVERY_RATES = {
            'standard': Decimal('50.00'),
            'express': Decimal('100.00'),
            'regional': Decimal('150.00')
        }
        shipping_fee = DELIVERY_RATES.get(delivery_method, Decimal('50.00'))
        tax = round(subtotal * Decimal('0.15'), 2)  # Standard 15% VAT
        total_amount = subtotal + shipping_fee + tax

        # Create Order - Chapa payment gateway
        order = Order.objects.create(
            customer=request.user,
            subtotal=subtotal,
            tax=tax,
            shipping_fee=shipping_fee,
            total_amount=total_amount,
            shipping_name=shipping_name,
            shipping_phone=shipping_phone,
            shipping_address=shipping_address,
            shipping_city=shipping_city,
            notes=notes,
            payment_method='CHAPA',
            payment_status=Order.PaymentStatus.PENDING,
            fulfillment_status=Order.FulfillmentStatus.PENDING,
            currency='ETB',
            payment_initiated_at=timezone.now(),
            status=Order.Status.PENDING_PAYMENT
        )

        # Record initial OrderStatusHistory
        OrderStatusHistory.objects.create(
            order=order,
            changed_by=request.user,
            status_type='FULFILLMENT',
            previous_status='NONE',
            new_status=Order.FulfillmentStatus.PENDING,
            comment="Order placed by customer via online checkout."
        )

        # Create OrderItems, snapshot warranty policy, reduce stock, record movements
        for item in cart_items:
            unit_price = Decimal(str(item.product.current_price))
            policy = getattr(item.product, 'resolved_warranty', None)
            duration = policy.duration_days if policy else 7
            coverage = policy.coverage_summary if policy else "Standard 7-Day Guarantee"
            terms = policy.terms_and_conditions if policy else "Valid from delivery date. Excludes liquid or physical drop damage."

            OrderItem.objects.create(
                order=order,
                product=item.product,
                quantity=item.quantity,
                unit_price=unit_price,
                total_price=unit_price * item.quantity,
                warranty_duration_days=duration,
                warranty_coverage=coverage,
                warranty_terms=terms
            )
            item.product.stock -= item.quantity
            item.product.save()

            StockMovement.objects.create(
                product=item.product,
                quantity=-item.quantity,
                movement_type=StockMovement.MovementType.SALE,
                reference=f"Order {order.order_number}",
                created_by=request.user
            )

            # Log purchase activity for AI
            try:
                CustomerActivity.objects.create(
                    user=request.user,
                    product=item.product,
                    activity_type=CustomerActivity.ActivityType.PURCHASE
                )
            except Exception:
                pass

        # Clear cart
        cart.items.all().delete()

        # Update customer profile order count (total_spent is strictly incremented only upon verified payment)
        if hasattr(request.user, 'profile'):
            profile = request.user.profile
            profile.order_count += 1
            profile.save()

        # Create customer notification with deduplication event_key
        notif_msg = (
            f"Your order for ETB {total_amount:.2f} has been placed. Proceed to pay securely with Chapa."
            if payment_method == 'CHAPA'
            else f"Your order for ETB {total_amount:.2f} has been created. Please upload your payment evidence to complete verification."
        )
        create_order_notification(
            user=request.user,
            title=f"Order Placed #{order.order_number}",
            message=notif_msg,
            notification_type=Notification.NotificationType.ORDER_PLACED,
            order_number=order.order_number,
            link=f"/orders/{order.id}",
            event_key=f"order_placed:{order.order_number}"
        )

        # Notify store managers, order managers, and administrators
        customer_display = request.user.get_full_name() or request.user.username
        staff_recipients = User.objects.filter(
            Q(role__in=[User.Role.STORE_MANAGER, User.Role.ADMIN, User.Role.ORDER_MANAGER]) |
            Q(is_superuser=True) |
            Q(is_staff=True)
        ).exclude(id=request.user.id).distinct()

        for staff_user in staff_recipients:
            if staff_user.role == User.Role.ORDER_MANAGER:
                review_link = f"/order-manager/dashboard?order_id={order.id}"
            elif staff_user.role == User.Role.ADMIN or staff_user.is_superuser:
                review_link = f"/admin/orders?order_id={order.id}"
            else:
                review_link = f"/manager/orders?order_id={order.id}"
            Notification.objects.create(
                user=staff_user,
                title=f"New Order Placed: #{order.order_number}",
                message=f"Customer {customer_display} placed a new order #{order.order_number} for ETB {total_amount:.2f} ({order.payment_method}). Click to review.",
                notification_type=Notification.NotificationType.ORDER_UPDATE,
                link=review_link
            )

        # If paying via Chapa, initialize session
        response_data = OrderSerializer(order).data
        if payment_method == 'CHAPA':
            return_url = request.data.get('return_url')
            callback_url = request.data.get('callback_url')
            chapa_init = ChapaService.initialize_payment(order, return_url=return_url, callback_url=callback_url)
            if chapa_init.get('status') == 'success':
                response_data['checkout_url'] = chapa_init.get('checkout_url')
                response_data['tx_ref'] = chapa_init.get('tx_ref')
            else:
                response_data['chapa_error'] = chapa_init.get('message')

        return Response(response_data, status=status.HTTP_201_CREATED)


class OrderListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OrderSerializer

    def get_queryset(self):
        user = self.request.user
        status_param = self.request.query_params.get('status')
        payment_status_param = self.request.query_params.get('payment_status')
        fulfillment_status_param = self.request.query_params.get('fulfillment_status') or self.request.query_params.get('order_status')
        customer_param = self.request.query_params.get('customer')
        order_number_param = self.request.query_params.get('order_number')
        date_from_param = self.request.query_params.get('date_from')
        date_to_param = self.request.query_params.get('date_to')
        search_param = self.request.query_params.get('search')

        # RBAC Check: Customers view their own orders; staff requires 'orders.view'
        if not user.is_customer():
            if not (getattr(user, 'is_super_admin', False) or user.has_permission('orders.view')):
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Access denied. Required permission: 'orders.view'.")
            qs = Order.objects.all().select_related('customer').prefetch_related('items__product', 'status_history')
        else:
            qs = Order.objects.filter(customer=user).select_related('customer').prefetch_related('items__product', 'status_history')

        if payment_status_param:
            qs = qs.filter(payment_status__iexact=payment_status_param.strip())

        if fulfillment_status_param:
            f_term = fulfillment_status_param.strip()
            qs = qs.filter(Q(fulfillment_status__iexact=f_term) | Q(status__iexact=f_term))
        elif status_param:
            s_term = status_param.strip()
            qs = qs.filter(Q(status__iexact=s_term) | Q(fulfillment_status__iexact=s_term))

        if customer_param:
            c_term = customer_param.strip()
            qs = qs.filter(
                Q(customer__username__icontains=c_term) |
                Q(customer__email__icontains=c_term) |
                Q(shipping_name__icontains=c_term)
            )

        if order_number_param:
            qs = qs.filter(order_number__icontains=order_number_param.strip())

        if date_from_param:
            try:
                qs = qs.filter(created_at__date__gte=date_from_param.strip())
            except Exception:
                pass

        if date_to_param:
            try:
                qs = qs.filter(created_at__date__lte=date_to_param.strip())
            except Exception:
                pass

        if search_param:
            term = search_param.strip()
            qs = qs.filter(
                Q(order_number__icontains=term) |
                Q(chapa_tx_ref__icontains=term) |
                Q(customer__username__icontains=term) |
                Q(shipping_name__icontains=term) |
                Q(shipping_phone__icontains=term)
            )

        return qs


class OrderDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OrderSerializer

    def get_object(self):
        obj = generics.get_object_or_404(Order, pk=self.kwargs['pk'])
        user = self.request.user

        # Customer Data Isolation: Customer can strictly only view their own order
        if user.is_customer():
            if obj.customer != user:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Access denied. You cannot view another customer's orders.")
        else:
            # Staff viewing order requires 'orders.view' or Super Admin
            if not (getattr(user, 'is_super_admin', False) or user.has_permission('orders.view')):
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Access denied. Required permission: 'orders.view'.")

        return obj


class PaymentEvidenceUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, order_id):
        try:
            order = Order.objects.get(id=order_id, customer=request.user)
        except Order.DoesNotExist:
            return Response({'error': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        if order.status not in [Order.Status.PENDING_PAYMENT, Order.Status.PAYMENT_SUBMITTED]:
            return Response({'error': 'Payment evidence cannot be uploaded for this order status.'}, status=status.HTTP_400_BAD_REQUEST)

        payment_method = request.data.get('payment_method')
        transaction_reference = request.data.get('transaction_reference')
        evidence_image = request.FILES.get('evidence_image')

        if not payment_method or not transaction_reference:
            return Response({'error': 'Payment method and transaction reference are required.'}, status=status.HTTP_400_BAD_REQUEST)

        if not evidence_image and not hasattr(order, 'payment_evidence'):
            return Response({'error': 'Evidence receipt image is required.'}, status=status.HTTP_400_BAD_REQUEST)

        evidence, created = PaymentEvidence.objects.update_or_create(
            order=order,
            defaults={
                'payment_method': payment_method,
                'transaction_reference': transaction_reference,
                'verification_status': PaymentEvidence.VerificationStatus.PENDING,
                'rejection_reason': None
            }
        )
        if evidence_image:
            evidence.evidence_image = evidence_image
            evidence.save()

        order.status = Order.Status.PAYMENT_SUBMITTED
        order.save()

        # In-app notification to store managers and administrators
        customer_display = request.user.get_full_name() or request.user.username
        staff_recipients = User.objects.filter(
            Q(role__in=[User.Role.STORE_MANAGER, User.Role.ADMIN]) |
            Q(is_superuser=True) |
            Q(is_staff=True)
        ).exclude(id=request.user.id).distinct()

        for mgr in staff_recipients:
            review_link = (
                f"/admin/orders?order_id={order.id}"
                if (mgr.role == User.Role.ADMIN or mgr.is_superuser)
                else f"/manager/orders?order_id={order.id}"
            )
            Notification.objects.create(
                user=mgr,
                title="New Payment Evidence Uploaded",
                message=f"Customer {customer_display} uploaded payment evidence for Order #{order.order_number}. Click to review and verify.",
                notification_type=Notification.NotificationType.ORDER_UPDATE,
                link=review_link
            )

        return Response({
            'message': 'Payment evidence submitted successfully and is under review.',
            'evidence': PaymentEvidenceSerializer(evidence).data,
            'order': OrderSerializer(order).data
        })


class StoreManagerPaymentVerificationView(APIView):
    permission_classes = [require_permission('payments.verify')]

    def post(self, request, order_id):
        try:
            order = Order.objects.get(id=order_id)
            evidence = order.payment_evidence
        except (Order.DoesNotExist, PaymentEvidence.DoesNotExist):
            return Response({'error': 'Order or payment evidence not found.'}, status=status.HTTP_404_NOT_FOUND)

        action = request.data.get('action')  # 'approve' or 'reject'
        reason = request.data.get('reason', '')

        if action == 'approve':
            evidence.verification_status = PaymentEvidence.VerificationStatus.APPROVED
            evidence.verified_by = request.user
            evidence.verified_at = timezone.now()
            evidence.rejection_reason = None
            evidence.save()

            order.status = Order.Status.PROCESSING
            order.save()

            # Generate official receipt
            receipt, _ = Receipt.objects.get_or_create(
                order=order,
                defaults={'verified_by': request.user}
            )

            # Customer in-app notification
            Notification.objects.create(
                user=order.customer,
                title="Payment Verified & Receipt Issued!",
                message=f"Your payment for Order #{order.order_number} has been verified. Official Receipt #{receipt.receipt_number} is now ready to download.",
                notification_type=Notification.NotificationType.PAYMENT_VERIFIED,
                link=f"/receipts/{order.id}"
            )

            return Response({
                'message': 'Payment approved successfully.',
                'order': OrderSerializer(order).data,
                'receipt': ReceiptSerializer(receipt).data
            })

        elif action == 'reject':
            evidence.verification_status = PaymentEvidence.VerificationStatus.REJECTED
            evidence.verified_by = request.user
            evidence.verified_at = timezone.now()
            evidence.rejection_reason = reason or "Evidence could not be verified with the bank."
            evidence.save()

            order.status = Order.Status.PENDING_PAYMENT
            order.save()

            # Customer in-app notification
            Notification.objects.create(
                user=order.customer,
                title="Payment Evidence Rejected",
                message=f"Your payment evidence for Order #{order.order_number} was rejected. Reason: {evidence.rejection_reason}. Please re-upload valid evidence.",
                notification_type=Notification.NotificationType.PAYMENT_REJECTED,
                link=f"/orders/{order.id}"
            )

            return Response({
                'message': 'Payment rejected.',
                'order': OrderSerializer(order).data
            })

        return Response({'error': "Invalid action. Must be 'approve' or 'reject'."}, status=status.HTTP_400_BAD_REQUEST)


class StoreManagerOrderStatusUpdateView(APIView):
    permission_classes = [require_permission('orders.update')]

    def patch(self, request, order_id):
        try:
            order = Order.objects.get(id=order_id)
        except Order.DoesNotExist:
            return Response({'error': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        raw_status = request.data.get('fulfillment_status') or request.data.get('status')
        comment = request.data.get('comment', '').strip()
        reconciliation_note = request.data.get('reconciliation_note', '').strip()

        if not raw_status:
            return Response({'error': 'Status is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Normalize incoming status
        status_map = {
            'PENDING_PAYMENT': Order.FulfillmentStatus.PENDING,
            'PAYMENT_SUBMITTED': Order.FulfillmentStatus.PENDING,
            'PENDING': Order.FulfillmentStatus.PENDING,
            'CONFIRMED': Order.FulfillmentStatus.CONFIRMED,
            'PROCESSING': Order.FulfillmentStatus.PROCESSING,
            'SHIPPED': Order.FulfillmentStatus.SHIPPED,
            'DELIVERED': Order.FulfillmentStatus.DELIVERED,
            'CANCELLED': Order.FulfillmentStatus.CANCELLED,
            'REFUNDED': Order.FulfillmentStatus.REFUNDED,
        }
        target_status = status_map.get(raw_status.strip().upper())
        if not target_status:
            return Response({'error': f"Invalid fulfillment status: '{raw_status}'."}, status=status.HTTP_400_BAD_REQUEST)

        curr_status = order.fulfillment_status or Order.FulfillmentStatus.PENDING

        # Controlled status transitions
        ALLOWED_TRANSITIONS = {
            Order.FulfillmentStatus.PENDING: [Order.FulfillmentStatus.CONFIRMED, Order.FulfillmentStatus.CANCELLED],
            Order.FulfillmentStatus.CONFIRMED: [Order.FulfillmentStatus.PROCESSING, Order.FulfillmentStatus.CANCELLED],
            Order.FulfillmentStatus.PROCESSING: [Order.FulfillmentStatus.SHIPPED, Order.FulfillmentStatus.CANCELLED],
            Order.FulfillmentStatus.SHIPPED: [Order.FulfillmentStatus.DELIVERED, Order.FulfillmentStatus.CANCELLED],
            Order.FulfillmentStatus.DELIVERED: [Order.FulfillmentStatus.REFUNDED],
            Order.FulfillmentStatus.CANCELLED: [],
            Order.FulfillmentStatus.REFUNDED: [],
        }

        # Allow no-op without error
        if target_status == curr_status:
            return Response(OrderSerializer(order).data)

        # Enforce valid workflow unless superuser override
        allowed_next = ALLOWED_TRANSITIONS.get(curr_status, [])
        if target_status not in allowed_next and not request.user.is_superuser:
            allowed_labels = ", ".join(allowed_next) if allowed_next else "None (Terminal State)"
            return Response({
                'error': f"Invalid status transition from {curr_status} to {target_status}. Allowed next steps: {allowed_labels}."
            }, status=status.HTTP_400_BAD_REQUEST)

        # Guard: Cannot fulfill unpaid orders without verified payment or explicit reconciliation audit
        if target_status in [
            Order.FulfillmentStatus.CONFIRMED,
            Order.FulfillmentStatus.PROCESSING,
            Order.FulfillmentStatus.SHIPPED,
            Order.FulfillmentStatus.DELIVERED
        ]:
            is_verified = (
                order.payment_status == Order.PaymentStatus.PAID or
                (hasattr(order, 'payment_evidence') and order.payment_evidence.verification_status == PaymentEvidence.VerificationStatus.APPROVED) or
                hasattr(order, 'receipt')
            )
            if not is_verified:
                if not reconciliation_note:
                    return Response({
                        'error': 'Cannot advance fulfillment on an unpaid order. Payment must be verified via Chapa or approved bank evidence first, or provide an audited reconciliation note.'
                    }, status=status.HTTP_400_BAD_REQUEST)
                # Record payment reconciliation in AuditLog
                AuditLog.objects.create(
                    user=request.user,
                    action="PAYMENT_RECONCILIATION_OVERRIDE",
                    details=f"Admin {request.user.username} authorized fulfillment for unpaid order #{order.order_number}. Reconciliation note: {reconciliation_note}"
                )

        # If transitioning to DELIVERED, activate warranty starting from today
        if target_status == Order.FulfillmentStatus.DELIVERED:
            import datetime
            now = timezone.now()
            for item in order.items.all():
                if not item.warranty_start_date:
                    item.warranty_start_date = now
                    item.warranty_end_date = now + datetime.timedelta(days=item.warranty_duration_days)
                    item.save()

        # Update order fulfillment status
        prev_status = curr_status
        order.fulfillment_status = target_status
        order.save()

        # Record in OrderStatusHistory
        OrderStatusHistory.objects.create(
            order=order,
            changed_by=request.user,
            status_type='FULFILLMENT',
            previous_status=prev_status,
            new_status=target_status,
            comment=comment or f"Status transitioned from {prev_status} to {target_status} by {request.user.username}"
        )

        # Record in administrative AuditLog
        AuditLog.objects.create(
            user=request.user,
            action="ORDER_FULFILLMENT_UPDATE",
            details=f"Order #{order.order_number} status changed from {prev_status} to {target_status} by {request.user.username}. Comment: {comment or 'N/A'}"
        )

        # Send customer notification
        notif_map = {
            Order.FulfillmentStatus.CONFIRMED: (
                "Order Confirmed by Admin",
                f"Your order #{order.order_number} has been reviewed and confirmed. Fulfillment is now underway.",
                Notification.NotificationType.ORDER_CONFIRMED
            ),
            Order.FulfillmentStatus.PROCESSING: (
                "Order in Processing",
                f"Your order #{order.order_number} is being assembled and packed in our Addis Ababa store.",
                Notification.NotificationType.ORDER_PROCESSING
            ),
            Order.FulfillmentStatus.SHIPPED: (
                "Order Dispatched / In Transit",
                f"Your order #{order.order_number} has been shipped! Our courier is delivering to your address.",
                Notification.NotificationType.ORDER_SHIPPED
            ),
            Order.FulfillmentStatus.DELIVERED: (
                "Order Delivered Successfully!",
                f"Your order #{order.order_number} has been delivered. Your hardware warranty is now active.",
                Notification.NotificationType.ORDER_DELIVERED
            ),
            Order.FulfillmentStatus.CANCELLED: (
                "Order Cancelled",
                f"Your order #{order.order_number} has been cancelled. Reason: {comment or 'Customer requested or cancelled by administrator.'}",
                Notification.NotificationType.ORDER_CANCELLED
            ),
            Order.FulfillmentStatus.REFUNDED: (
                "Order Refunded",
                f"Your order #{order.order_number} has been marked as refunded. Settlement details: {comment or 'Processed.'}",
                Notification.NotificationType.ORDER_REFUNDED
            ),
        }

        notif_info = notif_map.get(target_status)
        if notif_info:
            n_title, n_msg, n_type = notif_info
            create_order_notification(
                user=order.customer,
                title=n_title,
                message=n_msg,
                notification_type=n_type,
                order_number=order.order_number,
                link=f"/orders/{order.id}",
                event_key=f"fulfillment_update:{order.order_number}:{target_status}"
            )

        return Response(OrderSerializer(order).data)


class ReceiptDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, order_id):
        try:
            order = Order.objects.get(id=order_id)
        except Order.DoesNotExist:
            return Response({'error': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Ensure user is order owner or has staff orders.view / payments.view permission
        is_owner = (order.customer == request.user)
        has_staff_access = (
            getattr(request.user, 'is_super_admin', False) or
            request.user.has_permission('orders.view') or
            request.user.has_permission('payments.view')
        )
        if not is_owner and not has_staff_access:
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        if not hasattr(order, 'receipt'):
            return Response({'error': 'Receipt has not been issued yet. Payment must be verified first.'}, status=status.HTTP_404_NOT_FOUND)

        receipt = order.receipt
        receipt.download_count += 1
        receipt.save()

        return Response({
            'receipt': ReceiptSerializer(receipt).data,
            'order': OrderSerializer(order).data
        })


class ChapaInitializePaymentView(APIView):
    """
    Initializes a hosted payment checkout session with Chapa.
    Accepts order_id in URL path or JSON body.
    Returns hosted checkout_url to redirect user to.
    """
    permission_classes = [permissions.IsAuthenticated, IsNotAdmin]

    def post(self, request, order_id=None):
        target_order_id = order_id or request.data.get('order_id')
        if not target_order_id:
            return Response({'error': 'Order ID is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            order = Order.objects.get(id=target_order_id, customer=request.user)
        except Order.DoesNotExist:
            return Response({'error': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        if order.status in [Order.Status.PROCESSING, Order.Status.SHIPPED, Order.Status.DELIVERED]:
            return Response({'error': 'This order has already been paid and processed.'}, status=status.HTTP_400_BAD_REQUEST)

        return_url = request.data.get('return_url')
        callback_url = request.data.get('callback_url')
        result = ChapaService.initialize_payment(order, return_url=return_url, callback_url=callback_url)

        if result.get('status') == 'success':
            return Response({
                'status': 'success',
                'checkout_url': result.get('checkout_url'),
                'tx_ref': result.get('tx_ref'),
                'order': OrderSerializer(order).data
            })
        else:
            return Response({
                'status': 'error',
                'message': result.get('message', 'Failed to initialize Chapa payment.')
            }, status=status.HTTP_400_BAD_REQUEST)


class ChapaVerifyPaymentView(APIView):
    """
    Verifies payment directly with Chapa's official verification API.
    Enforces server-side amount, currency (ETB), and ownership checks before marking order as paid.
    Idempotent: prevents duplicate receipt issuance or double processing.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, order_id=None):
        return self._verify(request, order_id)

    def post(self, request, order_id=None):
        return self._verify(request, order_id)

    def _verify(self, request, order_id=None):
        target_order_id = order_id or request.data.get('order_id') or request.query_params.get('order_id')
        tx_ref = request.data.get('tx_ref') or request.query_params.get('tx_ref')

        order = None
        if target_order_id:
            try:
                order = Order.objects.get(id=target_order_id)
            except Order.DoesNotExist:
                pass

        if not order and tx_ref:
            order = Order.objects.filter(chapa_tx_ref=tx_ref).first()

        if not order:
            return Response({'error': 'Order not found for the given reference.'}, status=status.HTTP_404_NOT_FOUND)

        # Check ownership or staff access
        is_staff = request.user.role in [User.Role.STORE_MANAGER, User.Role.ADMIN] or request.user.is_superuser
        if order.customer != request.user and not is_staff:
            return Response({'error': 'You do not have permission to verify this order.'}, status=status.HTTP_403_FORBIDDEN)

        # Check if already verified
        if order.payment_status == Order.PaymentStatus.PAID or order.status in [Order.Status.PROCESSING, Order.Status.SHIPPED, Order.Status.DELIVERED]:
            receipt_data = ReceiptSerializer(order.receipt).data if hasattr(order, 'receipt') else None
            return Response({
                'status': 'success',
                'message': 'Payment already verified.',
                'order': OrderSerializer(order).data,
                'receipt': receipt_data
            })

        resolved_tx_ref = tx_ref or order.chapa_tx_ref
        if not resolved_tx_ref:
            return Response({'error': 'Transaction reference (tx_ref) is required for verification.'}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()

        # Verify transaction with Chapa API
        chapa_res = ChapaService.verify_payment(resolved_tx_ref)
        if chapa_res.get('status') != 'success':
            err_msg = chapa_res.get('message', 'Chapa payment verification failed.')
            order.last_verification_result = 'VERIFICATION_FAILED'
            order.verification_mismatch_message = err_msg
            order.save(update_fields=['last_verification_result', 'verification_mismatch_message'])
            return Response({
                'status': 'error',
                'message': err_msg
            }, status=status.HTTP_400_BAD_REQUEST)

        data = chapa_res.get('data', {})
        chapa_status = str(data.get('status', '')).lower()
        if chapa_status != 'success':
            err_msg = f"Chapa payment status is '{chapa_status}', not 'success'."
            order.payment_status = Order.PaymentStatus.FAILED
            order.last_verification_result = 'PAYMENT_FAILED'
            order.verification_mismatch_message = err_msg
            order.save(update_fields=['payment_status', 'last_verification_result', 'verification_mismatch_message'])
            create_order_notification(
                user=order.customer,
                title="Payment Failed",
                message=f"Payment for order #{order.order_number} was not successful. Please retry with Chapa.",
                notification_type=Notification.NotificationType.PAYMENT_FAILED,
                order_number=order.order_number,
                link=f"/orders/{order.id}",
                event_key=f"pay_failed:{order.order_number}:{resolved_tx_ref}"
            )
            return Response({
                'status': 'error',
                'message': err_msg
            }, status=status.HTTP_400_BAD_REQUEST)

        # Currency validation
        currency = str(data.get('currency', '')).upper()
        if currency != 'ETB':
            err_msg = f"Payment currency mismatch: expected ETB, got {currency}."
            order.last_verification_result = 'MISMATCH_DETECTED'
            order.verification_mismatch_message = err_msg
            order.save(update_fields=['last_verification_result', 'verification_mismatch_message'])
            return Response({
                'status': 'error',
                'message': err_msg
            }, status=status.HTTP_400_BAD_REQUEST)

        # Amount validation
        try:
            chapa_amount = Decimal(str(data.get('amount', '0')))
            order_amount = Decimal(str(order.total_amount))
            if abs(chapa_amount - order_amount) > Decimal('0.05'):
                err_msg = f"Payment amount mismatch: received ETB {chapa_amount}, expected ETB {order_amount}."
                order.last_verification_result = 'MISMATCH_DETECTED'
                order.verification_mismatch_message = err_msg
                order.verified_amount = chapa_amount
                order.save(update_fields=['last_verification_result', 'verification_mismatch_message', 'verified_amount'])
                logger.error(f"Price mismatch: Chapa amount {chapa_amount} != Order amount {order_amount}")
                return Response({
                    'status': 'error',
                    'message': err_msg
                }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'status': 'error', 'message': f'Amount validation error: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

        # Atomically mark order as PAID and PROCESSING, save evidence & issue receipt
        with transaction.atomic():
            order.payment_status = Order.PaymentStatus.PAID
            if order.fulfillment_status == Order.FulfillmentStatus.PENDING:
                order.fulfillment_status = Order.FulfillmentStatus.CONFIRMED
            order.status = Order.Status.PROCESSING
            order.payment_method = 'CHAPA'
            order.chapa_tx_ref = resolved_tx_ref
            order.verified_amount = chapa_amount
            order.payment_verified_at = now
            order.last_verification_result = 'VERIFIED_MATCH'
            order.verification_mismatch_message = None
            order.save()

            # Update customer total spent
            if hasattr(order.customer, 'profile'):
                profile = order.customer.profile
                profile.total_spent += order.total_amount
                profile.save()

            # Activate warranty for order items from payment verification date
            import datetime
            for item in order.items.all():
                if not item.warranty_start_date:
                    item.warranty_start_date = now
                    item.warranty_end_date = now + datetime.timedelta(days=item.warranty_duration_days)
                    item.save()

            evidence, _ = PaymentEvidence.objects.update_or_create(
                order=order,
                defaults={
                    'payment_method': f"Chapa ({data.get('method', 'Online')})",
                    'transaction_reference': data.get('reference') or resolved_tx_ref,
                    'verification_status': PaymentEvidence.VerificationStatus.APPROVED,
                    'verified_at': now,
                    'rejection_reason': None
                }
            )

            receipt, _ = Receipt.objects.get_or_create(
                order=order,
                defaults={'verified_by': None}
            )

            OrderStatusHistory.objects.create(
                order=order,
                changed_by=request.user,
                status_type='PAYMENT',
                previous_status=Order.PaymentStatus.PENDING,
                new_status=Order.PaymentStatus.PAID,
                comment=f"Payment verified with Chapa gateway. Amount: ETB {chapa_amount}."
            )

            create_order_notification(
                user=order.customer,
                title="Chapa Payment Verified & Receipt Ready!",
                message=f"Your Chapa payment of ETB {order.total_amount:.2f} for Order #{order.order_number} has been verified successfully.",
                notification_type=Notification.NotificationType.PAYMENT_VERIFIED,
                order_number=order.order_number,
                link=f"/receipts/{order.id}",
                event_key=f"payment_verified:{order.order_number}"
            )

            # Notify store managers and administrators
            customer_display = order.customer.get_full_name() or order.customer.username
            staff_recipients = User.objects.filter(
                Q(role__in=[User.Role.STORE_MANAGER, User.Role.ADMIN]) |
                Q(is_superuser=True) |
                Q(is_staff=True)
            ).exclude(id=order.customer.id).distinct()

            for mgr in staff_recipients:
                review_link = (
                    f"/admin/orders?order_id={order.id}"
                    if (mgr.role == User.Role.ADMIN or mgr.is_superuser)
                    else f"/manager/orders?order_id={order.id}"
                )
                create_order_notification(
                    user=mgr,
                    title=f"Payment Verified for Order #{order.order_number}",
                    message=f"Customer {customer_display} completed Chapa payment of ETB {order.total_amount:.2f} for Order #{order.order_number}. Ready for fulfillment.",
                    notification_type=Notification.NotificationType.PAYMENT_VERIFIED,
                    order_number=order.order_number,
                    link=review_link,
                    event_key=f"mgr_payment_verified:{order.order_number}:{mgr.id}"
                )

        return Response({
            'status': 'success',
            'message': 'Payment verified successfully.',
            'order': OrderSerializer(order).data,
            'receipt': ReceiptSerializer(receipt).data
        })


class AdminVerifyPaymentView(APIView):
    """
    Administrator Payment Verification Endpoint:
    Inspects and cross-checks transaction details directly with Chapa.
    Flags discrepancies in amount and currency instead of blindly accepting payment.
    Enforces atomic updates and auditable history.
    """
    permission_classes = [require_permission('payments.verify')]

    def post(self, request, order_id):
        try:
            order = Order.objects.get(id=order_id)
        except Order.DoesNotExist:
            return Response({'error': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        tx_ref = request.data.get('tx_ref') or order.chapa_tx_ref
        if not tx_ref:
            return Response({
                'error': f"Order #{order.order_number} does not have a Chapa transaction reference assigned."
            }, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        chapa_res = ChapaService.verify_payment(tx_ref)

        if chapa_res.get('status') != 'success':
            err_msg = chapa_res.get('message', 'Chapa verification request failed.')
            order.last_verification_result = 'VERIFICATION_FAILED'
            order.verification_mismatch_message = err_msg
            order.save(update_fields=['last_verification_result', 'verification_mismatch_message'])

            AuditLog.objects.create(
                user=request.user,
                action="ADMIN_PAYMENT_VERIFICATION_FAILED",
                details=f"Admin {request.user.username} tried verifying Order #{order.order_number}. Error: {err_msg}"
            )

            return Response({
                'status': 'error',
                'order_number': order.order_number,
                'chapa_tx_ref': tx_ref,
                'expected_amount': str(order.total_amount),
                'verified_amount': None,
                'currency': 'ETB',
                'payment_method': order.payment_method,
                'current_payment_status': order.payment_status,
                'payment_initiated_at': order.payment_initiated_at,
                'verification_time': now,
                'last_verification_result': 'VERIFICATION_FAILED',
                'mismatch_message': err_msg,
                'is_match': False,
                'message': err_msg
            }, status=status.HTTP_400_BAD_REQUEST)

        data = chapa_res.get('data', {})
        chapa_status = str(data.get('status', '')).lower()
        currency = str(data.get('currency', 'ETB')).upper()
        try:
            chapa_amount = Decimal(str(data.get('amount', '0')))
        except Exception:
            chapa_amount = Decimal('0.00')
        order_amount = Decimal(str(order.total_amount))
        method = data.get('method', 'Chapa Online')
        provider_ref = data.get('reference') or tx_ref

        # Check for discrepancies
        mismatches = []
        if chapa_status != 'success':
            mismatches.append(f"Gateway status '{chapa_status}' is not 'success'")
        if currency != 'ETB':
            mismatches.append(f"Currency '{currency}' does not match expected 'ETB'")
        if abs(chapa_amount - order_amount) > Decimal('0.05'):
            mismatches.append(f"Amount mismatch: received ETB {chapa_amount}, expected ETB {order_amount}")

        if mismatches:
            mismatch_str = "; ".join(mismatches)
            order.last_verification_result = 'MISMATCH_DETECTED'
            order.verification_mismatch_message = mismatch_str
            order.verified_amount = chapa_amount
            order.save(update_fields=['last_verification_result', 'verification_mismatch_message', 'verified_amount'])

            AuditLog.objects.create(
                user=request.user,
                action="PAYMENT_VERIFICATION_MISMATCH",
                details=f"Admin {request.user.username} verified Order #{order.order_number}. Discrepancy detected: {mismatch_str}"
            )

            return Response({
                'status': 'mismatch',
                'order_number': order.order_number,
                'chapa_tx_ref': tx_ref,
                'expected_amount': str(order_amount),
                'verified_amount': str(chapa_amount),
                'currency': currency,
                'payment_method': method,
                'current_payment_status': order.payment_status,
                'payment_initiated_at': order.payment_initiated_at,
                'verification_time': now,
                'last_verification_result': 'MISMATCH_DETECTED',
                'mismatch_message': mismatch_str,
                'is_match': False,
                'message': f"Payment verification flagged discrepancies: {mismatch_str}"
            }, status=status.HTTP_400_BAD_REQUEST)

        # Genuine verified payment confirmed
        with transaction.atomic():
            order.payment_status = Order.PaymentStatus.PAID
            if order.fulfillment_status == Order.FulfillmentStatus.PENDING:
                order.fulfillment_status = Order.FulfillmentStatus.CONFIRMED
            order.status = Order.Status.PROCESSING
            order.verified_amount = chapa_amount
            order.payment_verified_at = now
            order.last_verification_result = 'VERIFIED_MATCH'
            order.verification_mismatch_message = None
            order.payment_method = 'CHAPA'
            order.save()

            if hasattr(order.customer, 'profile'):
                profile = order.customer.profile
                profile.total_spent += order.total_amount
                profile.save()

            evidence, _ = PaymentEvidence.objects.update_or_create(
                order=order,
                defaults={
                    'payment_method': f"Chapa ({method})",
                    'transaction_reference': provider_ref,
                    'verification_status': PaymentEvidence.VerificationStatus.APPROVED,
                    'verified_by': request.user,
                    'verified_at': now,
                    'rejection_reason': None
                }
            )

            receipt, _ = Receipt.objects.get_or_create(
                order=order,
                defaults={'verified_by': request.user}
            )

            OrderStatusHistory.objects.create(
                order=order,
                changed_by=request.user,
                status_type='PAYMENT',
                previous_status=Order.PaymentStatus.PENDING,
                new_status=Order.PaymentStatus.PAID,
                comment=f"Payment verified with Chapa gateway by admin {request.user.username}. Confirmed: ETB {chapa_amount}."
            )

            AuditLog.objects.create(
                user=request.user,
                action="ADMIN_PAYMENT_VERIFIED",
                details=f"Admin {request.user.username} verified payment for Order #{order.order_number}. ETB {chapa_amount} verified."
            )

            create_order_notification(
                user=order.customer,
                title="Chapa Payment Verified & Receipt Ready!",
                message=f"Your payment of ETB {order.total_amount:.2f} for Order #{order.order_number} has been verified successfully.",
                notification_type=Notification.NotificationType.PAYMENT_VERIFIED,
                order_number=order.order_number,
                link=f"/receipts/{order.id}",
                event_key=f"payment_verified:{order.order_number}"
            )

        return Response({
            'status': 'success',
            'order_number': order.order_number,
            'chapa_tx_ref': tx_ref,
            'expected_amount': str(order_amount),
            'verified_amount': str(chapa_amount),
            'currency': currency,
            'payment_method': method,
            'current_payment_status': order.payment_status,
            'fulfillment_status': order.fulfillment_status,
            'payment_initiated_at': order.payment_initiated_at,
            'verification_time': now,
            'last_verification_result': 'VERIFIED_MATCH',
            'mismatch_message': None,
            'is_match': True,
            'receipt': ReceiptSerializer(receipt).data,
            'order': OrderSerializer(order).data,
            'message': 'Payment successfully verified with Chapa and confirmed.'
        })


class ChapaWebhookView(APIView):
    """
    Webhook handler for Chapa asynchronous event notifications.
    Validates webhook signature when CHAPA_WEBHOOK_SECRET is configured.
    Verifies transaction with Chapa before mutating order payment state.
    Deduplicates events safely using atomic transactions and event keys.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        webhook_secret = getattr(settings, 'CHAPA_WEBHOOK_SECRET', '')
        signature = request.headers.get('Chapa-Signature') or request.headers.get('x-chapa-signature')

        if webhook_secret and signature:
            computed_signature = hmac.new(
                webhook_secret.encode('utf-8'),
                request.body,
                hashlib.sha256
            ).hexdigest()
            if not hmac.compare_digest(signature, computed_signature):
                logger.warning("Chapa webhook signature mismatch. Rejecting webhook request.")
                return Response({'error': 'Invalid signature'}, status=status.HTTP_401_UNAUTHORIZED)

        tx_ref = request.data.get('tx_ref')
        if not tx_ref:
            return Response({'status': 'ignored', 'reason': 'No tx_ref'}, status=status.HTTP_200_OK)

        order = Order.objects.filter(chapa_tx_ref=tx_ref).first()
        if not order:
            return Response({'status': 'ignored', 'reason': 'Order not found'}, status=status.HTTP_200_OK)

        # Idempotent: If already paid, do not re-process
        if order.payment_status == Order.PaymentStatus.PAID:
            return Response({'status': 'success', 'message': 'Already processed'}, status=status.HTTP_200_OK)

        # Server-to-server verification check
        chapa_res = ChapaService.verify_payment(tx_ref)
        if chapa_res.get('status') == 'success' and str(chapa_res.get('data', {}).get('status', '')).lower() == 'success':
            data = chapa_res.get('data', {})
            chapa_amount = Decimal(str(data.get('amount', '0')))
            order_amount = Decimal(str(order.total_amount))
            currency = str(data.get('currency', 'ETB')).upper()

            # Confirm amount & currency match
            if currency == 'ETB' and abs(chapa_amount - order_amount) <= Decimal('0.05'):
                now = timezone.now()
                with transaction.atomic():
                    order.payment_status = Order.PaymentStatus.PAID
                    if order.fulfillment_status == Order.FulfillmentStatus.PENDING:
                        order.fulfillment_status = Order.FulfillmentStatus.CONFIRMED
                    order.status = Order.Status.PROCESSING
                    order.verified_amount = chapa_amount
                    order.payment_verified_at = now
                    order.last_verification_result = 'VERIFIED_MATCH'
                    order.verification_mismatch_message = None
                    order.payment_method = 'CHAPA'
                    order.save()

                    if hasattr(order.customer, 'profile'):
                        profile = order.customer.profile
                        profile.total_spent += order.total_amount
                        profile.save()

                    PaymentEvidence.objects.update_or_create(
                        order=order,
                        defaults={
                            'payment_method': f"Chapa ({data.get('method', 'Webhook')})",
                            'transaction_reference': data.get('reference') or tx_ref,
                            'verification_status': PaymentEvidence.VerificationStatus.APPROVED,
                            'verified_at': now
                        }
                    )
                    Receipt.objects.get_or_create(order=order)

                    OrderStatusHistory.objects.create(
                        order=order,
                        changed_by=None,
                        status_type='PAYMENT',
                        previous_status=Order.PaymentStatus.PENDING,
                        new_status=Order.PaymentStatus.PAID,
                        comment="Payment verified and confirmed via verified Chapa webhook event."
                    )

                    create_order_notification(
                        user=order.customer,
                        title="Chapa Payment Verified & Receipt Ready!",
                        message=f"Your payment of ETB {order.total_amount:.2f} for Order #{order.order_number} has been verified.",
                        notification_type=Notification.NotificationType.PAYMENT_VERIFIED,
                        order_number=order.order_number,
                        link=f"/receipts/{order.id}",
                        event_key=f"payment_verified:{order.order_number}"
                    )
        return Response({'status': 'success'}, status=status.HTTP_200_OK)


class WarrantyClaimListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if not user.is_customer():
            if not (getattr(user, 'is_super_admin', False) or user.has_permission('refunds.manage')):
                return Response({'error': "Access denied. Required permission: 'refunds.manage'."}, status=status.HTTP_403_FORBIDDEN)
            claims = WarrantyClaim.objects.all()
            status_param = request.query_params.get('status')
            if status_param:
                claims = claims.filter(status=status_param)
            return Response(WarrantyClaimSerializer(claims, many=True).data)

        claims = WarrantyClaim.objects.filter(customer=user)
        return Response(WarrantyClaimSerializer(claims, many=True).data)

    def post(self, request):
        order_item_id = request.data.get('order_item_id') or request.data.get('order_item')
        issue_description = request.data.get('issue_description')
        evidence_image = request.FILES.get('evidence_image')

        if not order_item_id or not issue_description:
            return Response({'error': 'Order item ID and issue description are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            order_item = OrderItem.objects.get(id=order_item_id, order__customer=request.user)
        except OrderItem.DoesNotExist:
            return Response({'error': 'Purchased order item not found or does not belong to your account.'}, status=status.HTTP_404_NOT_FOUND)

        if order_item.order.status not in [Order.Status.PROCESSING, Order.Status.SHIPPED, Order.Status.DELIVERED]:
            return Response({'error': 'Warranty claims can only be filed after an order is confirmed or delivered.'}, status=status.HTTP_400_BAD_REQUEST)

        claim = WarrantyClaim.objects.create(
            order_item=order_item,
            customer=request.user,
            issue_description=issue_description,
            evidence_image=evidence_image,
            status=WarrantyClaim.ClaimStatus.SUBMITTED
        )

        return Response(WarrantyClaimSerializer(claim).data, status=status.HTTP_201_CREATED)


class WarrantyClaimDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        try:
            claim = WarrantyClaim.objects.get(id=pk)
        except WarrantyClaim.DoesNotExist:
            return Response({'error': 'Warranty claim not found.'}, status=status.HTTP_404_NOT_FOUND)

        is_staff = request.user.role in [User.Role.STORE_MANAGER, User.Role.ADMIN] or request.user.is_superuser
        if claim.customer != request.user and not is_staff:
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        return Response(WarrantyClaimSerializer(claim).data)

    def patch(self, request, pk):
        if not (getattr(request.user, 'is_super_admin', False) or request.user.has_permission('refunds.manage')):
            return Response({'error': "Access denied. Required permission: 'refunds.manage'."}, status=status.HTTP_403_FORBIDDEN)

        try:
            claim = WarrantyClaim.objects.get(id=pk)
        except WarrantyClaim.DoesNotExist:
            return Response({'error': 'Warranty claim not found.'}, status=status.HTTP_404_NOT_FOUND)

        new_status = request.data.get('status')
        admin_notes = request.data.get('admin_notes')
        rejection_reason = request.data.get('rejection_reason')
        resolution_details = request.data.get('resolution_details')

        if new_status and new_status in [c[0] for c in WarrantyClaim.ClaimStatus.choices]:
            claim.status = new_status
        if admin_notes is not None:
            claim.admin_notes = admin_notes
        if rejection_reason is not None:
            claim.rejection_reason = rejection_reason
        if resolution_details is not None:
            claim.resolution_details = resolution_details

        claim.reviewed_by = request.user
        claim.save()

        Notification.objects.create(
            user=claim.customer,
            title=f"Warranty Claim #{claim.claim_number} Status Update",
            message=f"Your warranty claim for {claim.order_item.product.name} is now: {claim.get_status_display()}.",
            notification_type=Notification.NotificationType.ORDER_UPDATE,
            link=f"/orders/{claim.order_item.order.id}"
        )

        return Response(WarrantyClaimSerializer(claim).data)


class CustomerDashboardSummaryView(APIView):
    """
    Retrieves authoritative authenticated customer metrics and recent orders.
    Calculates exact total orders, total verified spent in ETB, and issued receipts.
    Strictly isolated to request.user to prevent data leakage.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        orders_qs = Order.objects.filter(customer=user)
        total_orders = orders_qs.count()

        # Count completed purchases only (payment verified and processed, never pending or cancelled)
        verified_orders = orders_qs.filter(status__in=[
            Order.Status.PROCESSING,
            Order.Status.SHIPPED,
            Order.Status.DELIVERED
        ])
        total_spent = float(verified_orders.aggregate(total=Sum('total_amount'))['total'] or 0.0)

        # Count receipts that genuinely exist for this customer
        verified_receipts_count = Receipt.objects.filter(order__customer=user).count()

        # Latest 5 orders for authenticated customer
        recent_orders = orders_qs.order_by('-created_at')[:5]

        return Response({
            'total_orders': total_orders,
            'total_spent': total_spent,
            'verified_receipts_count': verified_receipts_count,
            'recent_orders': OrderSerializer(recent_orders, many=True).data
        })

