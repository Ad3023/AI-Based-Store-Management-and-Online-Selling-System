import logging
from decimal import Decimal
from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import transaction
from django.db.models import Sum, Q
from django.utils import timezone
from .models import Cart, CartItem, Order, OrderItem, PaymentEvidence, Receipt, WarrantyClaim
from .serializers import (
    CartSerializer, CartItemSerializer,
    OrderSerializer, PaymentEvidenceSerializer, ReceiptSerializer,
    WarrantyClaimSerializer
)
from .chapa import ChapaService
from products.models import Product, StockMovement
from accounts.permissions import IsStoreManagerOrAdmin
from accounts.models import User
from notifications.models import Notification
from recommendations.models import CustomerActivity

logger = logging.getLogger(__name__)


class CartView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        cart, _ = Cart.objects.get_or_create(user=request.user)
        return Response(CartSerializer(cart).data)

    def post(self, request):
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
        # Remove item or clear cart
        cart, _ = Cart.objects.get_or_create(user=request.user)
        item_id = request.data.get('item_id')
        if item_id:
            CartItem.objects.filter(id=item_id, cart=cart).delete()
        else:
            cart.items.all().delete()
        return Response(CartSerializer(cart).data)


class CheckoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request):
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
            status=Order.Status.PENDING_PAYMENT
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

        # Create customer notification
        notif_msg = (
            f"Your order for ETB {total_amount:.2f} has been created. Complete payment via Chapa for instant activation."
            if payment_method == 'CHAPA'
            else f"Your order for ETB {total_amount:.2f} has been created. Please upload your payment evidence to complete verification."
        )
        Notification.objects.create(
            user=request.user,
            title=f"Order Placed #{order.order_number}",
            message=notif_msg,
            notification_type=Notification.NotificationType.ORDER_UPDATE,
            link=f"/orders/{order.id}"
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
        search_param = self.request.query_params.get('search')

        if user.role in [User.Role.STORE_MANAGER, User.Role.ADMIN] or user.is_superuser:
            qs = Order.objects.all()
        else:
            qs = Order.objects.filter(customer=user)

        if status_param:
            qs = qs.filter(status=status_param)
        if search_param:
            term = search_param.strip()
            qs = qs.filter(Q(order_number__icontains=term) | Q(chapa_tx_ref__icontains=term))
        return qs


class OrderDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OrderSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role in [User.Role.STORE_MANAGER, User.Role.ADMIN] or user.is_superuser:
            return Order.objects.all()
        return Order.objects.filter(customer=user)


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

        # In-app notification to store managers
        managers = User.objects.filter(role__in=[User.Role.STORE_MANAGER, User.Role.ADMIN])
        for mgr in managers:
            Notification.objects.create(
                user=mgr,
                title="New Payment Evidence Uploaded",
                message=f"Customer {request.user.username} uploaded payment evidence for Order #{order.order_number}.",
                notification_type=Notification.NotificationType.ORDER_UPDATE,
                link=f"/manager/orders/{order.id}"
            )

        return Response({
            'message': 'Payment evidence submitted successfully and is under review.',
            'evidence': PaymentEvidenceSerializer(evidence).data,
            'order': OrderSerializer(order).data
        })


class StoreManagerPaymentVerificationView(APIView):
    permission_classes = [IsStoreManagerOrAdmin]

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
    permission_classes = [IsStoreManagerOrAdmin]

    def patch(self, request, order_id):
        try:
            order = Order.objects.get(id=order_id)
        except Order.DoesNotExist:
            return Response({'error': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        new_status = request.data.get('status')
        if new_status not in [c[0] for c in Order.Status.choices]:
            return Response({'error': 'Invalid status.'}, status=status.HTTP_400_BAD_REQUEST)

        order.status = new_status
        order.save()

        Notification.objects.create(
            user=order.customer,
            title=f"Order Status Update: {order.get_status_display()}",
            message=f"Your order #{order.order_number} status has been updated to: {order.get_status_display()}.",
            notification_type=Notification.NotificationType.ORDER_UPDATE,
            link=f"/orders/{order.id}"
        )

        return Response(OrderSerializer(order).data)


class ReceiptDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, order_id):
        try:
            order = Order.objects.get(id=order_id)
        except Order.DoesNotExist:
            return Response({'error': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Ensure user is customer or manager/admin
        if order.customer != request.user and not (request.user.role in [User.Role.STORE_MANAGER, User.Role.ADMIN] or request.user.is_superuser):
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
    permission_classes = [permissions.IsAuthenticated]

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
        if order.status in [Order.Status.PROCESSING, Order.Status.SHIPPED, Order.Status.DELIVERED]:
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

        # Verify transaction with Chapa API
        chapa_res = ChapaService.verify_payment(resolved_tx_ref)
        if chapa_res.get('status') != 'success':
            return Response({
                'status': 'error',
                'message': chapa_res.get('message', 'Chapa payment verification failed.')
            }, status=status.HTTP_400_BAD_REQUEST)

        data = chapa_res.get('data', {})
        chapa_status = str(data.get('status', '')).lower()
        if chapa_status != 'success':
            return Response({
                'status': 'error',
                'message': f"Chapa payment status is '{chapa_status}', not 'success'."
            }, status=status.HTTP_400_BAD_REQUEST)

        # Currency validation
        currency = str(data.get('currency', '')).upper()
        if currency != 'ETB':
            return Response({
                'status': 'error',
                'message': f"Payment currency mismatch: expected ETB, got {currency}."
            }, status=status.HTTP_400_BAD_REQUEST)

        # Amount validation
        try:
            chapa_amount = Decimal(str(data.get('amount', '0')))
            order_amount = Decimal(str(order.total_amount))
            if abs(chapa_amount - order_amount) > Decimal('0.05'):
                logger.error(f"Price mismatch: Chapa amount {chapa_amount} != Order amount {order_amount}")
                return Response({
                    'status': 'error',
                    'message': f"Payment amount mismatch: received ETB {chapa_amount}, expected ETB {order_amount}."
                }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'status': 'error', 'message': f'Amount validation error: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

        # Atomically mark order as PROCESSING (Payment Verified), save evidence & issue receipt
        with transaction.atomic():
            order.status = Order.Status.PROCESSING
            order.payment_method = 'CHAPA'
            order.chapa_tx_ref = resolved_tx_ref
            order.save()

            # Activate warranty for order items from payment verification date
            import datetime
            now = timezone.now()
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

            Notification.objects.create(
                user=order.customer,
                title="Chapa Payment Verified & Receipt Ready!",
                message=f"Your Chapa payment of ETB {order.total_amount:.2f} for Order #{order.order_number} has been verified successfully.",
                notification_type=Notification.NotificationType.PAYMENT_VERIFIED,
                link=f"/receipts/{order.id}"
            )

        return Response({
            'status': 'success',
            'message': 'Payment verified successfully.',
            'order': OrderSerializer(order).data,
            'receipt': ReceiptSerializer(receipt).data
        })


class ChapaWebhookView(APIView):
    """
    Webhook handler for Chapa asynchronous event notifications.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        tx_ref = request.data.get('tx_ref')
        if not tx_ref:
            return Response({'status': 'ignored', 'reason': 'No tx_ref'}, status=status.HTTP_200_OK)

        order = Order.objects.filter(chapa_tx_ref=tx_ref).first()
        if not order:
            return Response({'status': 'ignored', 'reason': 'Order not found'}, status=status.HTTP_200_OK)

        if order.status in [Order.Status.PENDING_PAYMENT, Order.Status.PAYMENT_SUBMITTED]:
            chapa_res = ChapaService.verify_payment(tx_ref)
            if chapa_res.get('status') == 'success' and str(chapa_res.get('data', {}).get('status', '')).lower() == 'success':
                import datetime
                now = timezone.now()
                with transaction.atomic():
                    order.status = Order.Status.PROCESSING
                    order.payment_method = 'CHAPA'
                    order.save()

                    for item in order.items.all():
                        if not item.warranty_start_date:
                            item.warranty_start_date = now
                            item.warranty_end_date = now + datetime.timedelta(days=item.warranty_duration_days)
                            item.save()

                    PaymentEvidence.objects.update_or_create(
                        order=order,
                        defaults={
                            'payment_method': 'Chapa (Webhook)',
                            'transaction_reference': tx_ref,
                            'verification_status': PaymentEvidence.VerificationStatus.APPROVED,
                            'verified_at': now
                        }
                    )
                    Receipt.objects.get_or_create(order=order)
        return Response({'status': 'success'}, status=status.HTTP_200_OK)


class WarrantyClaimListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role in [User.Role.STORE_MANAGER, User.Role.ADMIN] or user.is_superuser:
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
        if not (request.user.role in [User.Role.STORE_MANAGER, User.Role.ADMIN] or request.user.is_superuser):
            return Response({'error': 'Permission denied. Staff only.'}, status=status.HTTP_403_FORBIDDEN)

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

