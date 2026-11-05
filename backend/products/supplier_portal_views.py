import logging
from decimal import Decimal
from django.utils import timezone
from django.db.models import Sum, Q, Count
from django.shortcuts import get_object_or_404
from rest_framework import views, generics, permissions, status
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from accounts.models import User
from accounts.validators import validate_email_address, validate_phone_number_format
from notifications.models import Notification
from .models import Supplier, PurchaseRequest, PurchaseOrderItem, SupplierInvoice, SupplierPayment, Product

logger = logging.getLogger(__name__)


class IsAuthenticatedSupplier(permissions.BasePermission):
    """
    Enforces that the user is authenticated, has the role 'supplier',
    and is linked to an active Supplier business record.
    Strictly denies customers, store managers, and admins from supplier-only portal endpoints.
    """
    message = "Access restricted to authenticated Supplier accounts with a verified business profile."

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated and request.user.is_active):
            return False
        if request.user.role != User.RoleChoices.SUPPLIER and not getattr(request.user, 'is_supplier', lambda: False)():
            return False
        supplier = getattr(request.user, 'supplier_profile', None)
        return supplier is not None and supplier.is_active


def log_supplier_action(user, action, details, request=None):
    """Record supplier governance actions in system AuditLog."""
    try:
        from accounts.models import AuditLog
        ip = request.META.get('REMOTE_ADDR') if request else None
        AuditLog.objects.create(
            user=user,
            action=action,
            details=details,
            ip_address=ip
        )
    except Exception as e:
        logger.warning(f"Failed to write supplier audit log: {e}")


def notify_store_and_admin(title, message, notification_type=Notification.NotificationType.SYSTEM, link=None):
    """Notify store managers and admins about supplier updates."""
    try:
        recipients = User.objects.filter(
            Q(role__in=[User.RoleChoices.ADMIN, User.RoleChoices.SUPER_ADMIN, User.RoleChoices.STORE_MANAGER]) |
            Q(is_superuser=True),
            is_active=True
        ).distinct()
        for u in recipients:
            Notification.objects.create(
                user=u,
                title=title,
                message=message,
                notification_type=notification_type,
                link=link
            )
    except Exception as e:
        logger.warning(f"Failed to create admin notification: {e}")


# ============================================================================
# 1. SUPPLIER DASHBOARD OVERVIEW
# ============================================================================

class SupplierDashboardStatsView(views.APIView):
    """
    Returns aggregated KPI metrics and operational summary for the authenticated supplier.
    Strictly isolated to the requesting supplier's own records.
    """
    permission_classes = [IsAuthenticatedSupplier]

    def get(self, request):
        supplier = request.user.supplier_profile
        base_pos = PurchaseRequest.objects.filter(supplier=supplier).exclude(
            status__in=[PurchaseRequest.Status.DRAFT, PurchaseRequest.Status.CANCELLED]
        )

        total_orders_received = base_pos.count()

        # Orders awaiting supplier action
        new_orders = base_pos.filter(
            status__in=[
                PurchaseRequest.Status.APPROVED,
                PurchaseRequest.Status.SENT_TO_SUPPLIER,
                PurchaseRequest.Status.AWAITING_SUPPLIER,
                PurchaseRequest.Status.SUBMITTED,
                PurchaseRequest.Status.ORDERED
            ],
            supplier_confirmed_at__isnull=True
        ).count()

        pending_responses = base_pos.filter(
            supplier_confirmed_at__isnull=True,
            status__in=[
                PurchaseRequest.Status.APPROVED,
                PurchaseRequest.Status.SENT_TO_SUPPLIER,
                PurchaseRequest.Status.AWAITING_SUPPLIER
            ]
        ).count()

        accepted_orders = base_pos.filter(
            status__in=[PurchaseRequest.Status.ACCEPTED, PurchaseRequest.Status.PARTIALLY_ACCEPTED]
        ).count()

        rejected_orders = base_pos.filter(status=PurchaseRequest.Status.REJECTED).count()

        preparing_orders = base_pos.filter(
            status__in=[PurchaseRequest.Status.PREPARING_ORDER, PurchaseRequest.Status.READY_FOR_DELIVERY]
        ).count()

        shipped_orders = base_pos.filter(status=PurchaseRequest.Status.SHIPPED).count()

        delivered_orders = base_pos.filter(
            status__in=[
                PurchaseRequest.Status.DELIVERED,
                PurchaseRequest.Status.PARTIALLY_RECEIVED,
                PurchaseRequest.Status.RECEIVED,
                PurchaseRequest.Status.COMPLETED
            ]
        ).count()

        # Invoices and Payments
        invoices_qs = SupplierInvoice.objects.filter(supplier=supplier)
        pending_invoices = invoices_qs.filter(status=SupplierInvoice.Status.PENDING_APPROVAL).count()
        approved_invoices = invoices_qs.filter(status=SupplierInvoice.Status.APPROVED).count()
        total_invoiced_amount = invoices_qs.exclude(status=SupplierInvoice.Status.REJECTED).aggregate(
            s=Sum('total_amount')
        )['s'] or Decimal('0.00')

        payments_qs = SupplierPayment.objects.filter(supplier=supplier)
        total_paid_amount = payments_qs.filter(
            payment_status__in=[SupplierPayment.PaymentStatus.PAID, SupplierPayment.PaymentStatus.AUTHORIZED]
        ).aggregate(s=Sum('amount_paid'))['s'] or Decimal('0.00')

        outstanding_balance = max(Decimal('0.00'), total_invoiced_amount - total_paid_amount)

        # Recent 5 Purchase Orders
        from .serializers import PurchaseRequestSerializer, SupplierInvoiceSerializer
        recent_pos = base_pos.select_related('product', 'supplier').prefetch_related('items')[:5]
        recent_invoices = invoices_qs.select_related('purchase_order')[:5]

        return Response({
            'supplier': {
                'id': supplier.id,
                'name': supplier.name,
                'contact_person': supplier.contact_person,
                'email': supplier.email,
                'phone': supplier.phone,
                'address': supplier.address,
                'status': supplier.status,
            },
            'kpis': {
                'total_orders_received': total_orders_received,
                'new_orders': new_orders,
                'pending_responses': pending_responses,
                'awaiting_response': pending_responses,
                'accepted_orders': accepted_orders,
                'rejected_orders': rejected_orders,
                'preparing_orders': preparing_orders,
                'shipped_orders': shipped_orders,
                'delivered_orders': delivered_orders,
                'pending_invoices': pending_invoices,
                'approved_invoices': approved_invoices,
                'total_invoiced_amount': str(total_invoiced_amount),
                'total_paid_amount': str(total_paid_amount),
                'outstanding_balance': str(outstanding_balance),
            },
            'metrics': {
                'total_orders_received': total_orders_received,
                'new_orders': new_orders,
                'pending_responses': pending_responses,
                'awaiting_response': pending_responses,
                'accepted_orders': accepted_orders,
                'rejected_orders': rejected_orders,
                'preparing_orders': preparing_orders,
                'shipped_orders': shipped_orders,
                'delivered_orders': delivered_orders,
                'pending_invoices': pending_invoices,
                'approved_invoices': approved_invoices,
                'total_invoiced_amount': str(total_invoiced_amount),
                'total_paid_amount': str(total_paid_amount),
                'outstanding_balance': str(outstanding_balance),
            },
            'recent_orders': PurchaseRequestSerializer(recent_pos, many=True).data,
            'recent_purchase_orders': PurchaseRequestSerializer(recent_pos, many=True).data,
            'recent_invoices': SupplierInvoiceSerializer(recent_invoices, many=True).data
        })


# ============================================================================
# 2. SUPPLIER PURCHASE ORDERS (LIST & DETAIL)
# ============================================================================

class SupplierPurchaseOrderListView(generics.ListAPIView):
    """
    List purchase orders sent by EthioTech Market to the authenticated supplier.
    Excludes internal drafts. Enforces strict supplier data isolation.
    """
    permission_classes = [IsAuthenticatedSupplier]

    def get_serializer_class(self):
        from .serializers import PurchaseRequestSerializer
        return PurchaseRequestSerializer

    def get_queryset(self):
        supplier = self.request.user.supplier_profile
        qs = PurchaseRequest.objects.filter(supplier=supplier).exclude(
            status__in=[PurchaseRequest.Status.DRAFT, PurchaseRequest.Status.CANCELLED]
        ).select_related('product', 'supplier', 'requested_by', 'approved_by').prefetch_related('items')

        # Status filtering
        status_param = self.request.query_params.get('status', '').strip().upper()
        if status_param == 'NEW':
            qs = qs.filter(
                status__in=[
                    PurchaseRequest.Status.APPROVED,
                    PurchaseRequest.Status.SENT_TO_SUPPLIER,
                    PurchaseRequest.Status.AWAITING_SUPPLIER,
                    PurchaseRequest.Status.SUBMITTED,
                    PurchaseRequest.Status.ORDERED
                ],
                supplier_confirmed_at__isnull=True
            )
        elif status_param == 'ACCEPTED':
            qs = qs.filter(status__in=[PurchaseRequest.Status.ACCEPTED, PurchaseRequest.Status.PARTIALLY_ACCEPTED])
        elif status_param == 'REJECTED':
            qs = qs.filter(status=PurchaseRequest.Status.REJECTED)
        elif status_param == 'PREPARING':
            qs = qs.filter(status__in=[PurchaseRequest.Status.PREPARING_ORDER, PurchaseRequest.Status.READY_FOR_DELIVERY])
        elif status_param == 'SHIPPED':
            qs = qs.filter(status=PurchaseRequest.Status.SHIPPED)
        elif status_param == 'DELIVERED':
            qs = qs.filter(status__in=[
                PurchaseRequest.Status.DELIVERED,
                PurchaseRequest.Status.PARTIALLY_RECEIVED,
                PurchaseRequest.Status.RECEIVED,
                PurchaseRequest.Status.COMPLETED
            ])
        elif status_param and hasattr(PurchaseRequest.Status, status_param):
            qs = qs.filter(status=getattr(PurchaseRequest.Status, status_param))

        # Search filter
        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(request_number__icontains=search) |
                Q(product__name__icontains=search) |
                Q(items__product__name__icontains=search)
            ).distinct()

        return qs


class SupplierPurchaseOrderDetailView(generics.RetrieveAPIView):
    """
    Detailed view of a single purchase order assigned strictly to the requesting supplier.
    """
    permission_classes = [IsAuthenticatedSupplier]

    def get_serializer_class(self):
        from .serializers import PurchaseRequestSerializer
        return PurchaseRequestSerializer

    def get_queryset(self):
        supplier = self.request.user.supplier_profile
        return PurchaseRequest.objects.filter(supplier=supplier).select_related(
            'product', 'supplier', 'requested_by', 'approved_by'
        ).prefetch_related('items__product')


# ============================================================================
# 3. SUPPLIER ORDER RESPONSE (ACCEPT, REJECT, PARTIAL, UNAVAILABLE, SUGGEST DATE)
# ============================================================================

class SupplierPurchaseOrderRespondView(views.APIView):
    """
    Supplier response to a purchase order:
    - ACCEPT: Confirm availability and accept order in full.
    - REJECT: Decline order with mandatory rejection reason.
    - PARTIAL: Accept partial quantity (specifies confirmed quantities per item).
    - UNAVAILABLE: Report product unavailability.
    - SUGGEST_DATE: Propose alternative delivery date.
    Original requested quantities and approved unit prices are never overwritten directly.
    """
    permission_classes = [IsAuthenticatedSupplier]

    def post(self, request, pk):
        supplier = request.user.supplier_profile
        po = get_object_or_404(PurchaseRequest, pk=pk, supplier=supplier)

        # Ensure order is in a state that permits response
        valid_response_states = [
            PurchaseRequest.Status.APPROVED,
            PurchaseRequest.Status.SENT_TO_SUPPLIER,
            PurchaseRequest.Status.AWAITING_SUPPLIER,
            PurchaseRequest.Status.SUBMITTED,
            PurchaseRequest.Status.ORDERED
        ]
        if po.status not in valid_response_states and not (po.status == PurchaseRequest.Status.ACCEPTED and request.data.get('action') == 'SUGGEST_DATE'):
            return Response(
                {'error': f"Order '{po.request_number}' is in [{po.get_status_display()}] state and cannot be modified."},
                status=status.HTTP_400_BAD_REQUEST
            )

        action = (request.data.get('action') or '').strip().upper()
        notes = (request.data.get('notes') or '').strip()

        if action == 'ACCEPT':
            po.status = PurchaseRequest.Status.ACCEPTED
            po.supplier_response = 'ACCEPTED'
            po.supplier_confirmed_at = timezone.now()
            po.supplier_confirmation_notes = notes or "Order accepted in full by supplier."
            # Confirm all items at requested quantities
            for item in po.items.all():
                item.confirmed_quantity = item.quantity
                item.save(update_fields=['confirmed_quantity'])
            po.save(update_fields=['status', 'supplier_response', 'supplier_confirmed_at', 'supplier_confirmation_notes', 'updated_at'])

            log_supplier_action(request.user, "PO_ACCEPTED", f"Supplier {supplier.name} accepted PO {po.request_number} in full.", request)
            notify_store_and_admin(
                title=f"PO {po.request_number} Accepted",
                message=f"Supplier '{supplier.name}' accepted purchase order {po.request_number}. Delivery expected by {po.expected_supply_date or 'scheduled date'}.",
                link=f"/manager/procurement/purchase-orders"
            )
            return Response({'message': f"Purchase Order '{po.request_number}' accepted successfully.", 'status': po.status})

        elif action == 'REJECT':
            reason = (request.data.get('reason') or request.data.get('rejection_reason') or notes).strip()
            if not reason:
                return Response({'error': 'A rejection reason is required when declining an order.'}, status=status.HTTP_400_BAD_REQUEST)

            po.status = PurchaseRequest.Status.REJECTED
            po.supplier_response = 'REJECTED'
            po.supplier_rejection_reason = reason
            po.supplier_confirmed_at = timezone.now()
            po.supplier_confirmation_notes = f"Rejected: {reason}"
            po.save(update_fields=['status', 'supplier_response', 'supplier_rejection_reason', 'supplier_confirmed_at', 'supplier_confirmation_notes', 'updated_at'])

            log_supplier_action(request.user, "PO_REJECTED", f"Supplier {supplier.name} rejected PO {po.request_number}. Reason: {reason}", request)
            notify_store_and_admin(
                title=f"PO {po.request_number} Rejected by Supplier",
                message=f"Supplier '{supplier.name}' declined purchase order {po.request_number}. Reason: {reason}",
                link=f"/manager/procurement/purchase-orders"
            )
            return Response({'message': f"Purchase Order '{po.request_number}' marked as rejected.", 'status': po.status})

        elif action == 'PARTIAL':
            confirmed_items = request.data.get('items', [])
            if not confirmed_items or not isinstance(confirmed_items, list):
                return Response({'error': 'Please provide confirmed quantities for the items.'}, status=status.HTTP_400_BAD_REQUEST)

            has_valid_item = False
            for c_item in confirmed_items:
                item_id = c_item.get('id')
                c_qty = c_item.get('confirmed_quantity')
                if item_id is not None and c_qty is not None:
                    po_item = po.items.filter(id=item_id).first()
                    if po_item:
                        try:
                            confirmed_num = max(0, int(c_qty))
                            po_item.confirmed_quantity = confirmed_num
                            po_item.save(update_fields=['confirmed_quantity'])
                            has_valid_item = True
                        except (ValueError, TypeError):
                            pass

            if not has_valid_item:
                return Response({'error': 'No valid item confirmed quantities were provided.'}, status=status.HTTP_400_BAD_REQUEST)

            po.status = PurchaseRequest.Status.PARTIALLY_ACCEPTED
            po.supplier_response = 'PARTIALLY_ACCEPTED'
            po.supplier_confirmed_at = timezone.now()
            po.supplier_confirmation_notes = notes or "Supplier confirmed partial product quantities."
            po.save(update_fields=['status', 'supplier_response', 'supplier_confirmed_at', 'supplier_confirmation_notes', 'updated_at'])

            log_supplier_action(request.user, "PO_PARTIALLY_ACCEPTED", f"Supplier {supplier.name} confirmed partial quantities for PO {po.request_number}.", request)
            notify_store_and_admin(
                title=f"PO {po.request_number} Partially Accepted",
                message=f"Supplier '{supplier.name}' accepted partial quantities for PO {po.request_number}. Review items and confirmed quantities.",
                link=f"/manager/procurement/purchase-orders"
            )
            return Response({'message': f"Partial acceptance for PO '{po.request_number}' recorded.", 'status': po.status})

        elif action == 'UNAVAILABLE':
            reason = notes or "Supplier reported requested products are currently out of stock / unavailable."
            po.status = PurchaseRequest.Status.REJECTED
            po.supplier_response = 'PRODUCT_UNAVAILABLE'
            po.supplier_rejection_reason = reason
            po.supplier_confirmed_at = timezone.now()
            po.supplier_confirmation_notes = f"Product Unavailable: {reason}"
            po.save(update_fields=['status', 'supplier_response', 'supplier_rejection_reason', 'supplier_confirmed_at', 'supplier_confirmation_notes', 'updated_at'])

            log_supplier_action(request.user, "PO_UNAVAILABLE", f"Supplier {supplier.name} reported product unavailability for PO {po.request_number}.", request)
            notify_store_and_admin(
                title=f"Products Unavailable for PO {po.request_number}",
                message=f"Supplier '{supplier.name}' reported items for PO {po.request_number} are unavailable. Reason: {reason}",
                link=f"/manager/procurement/purchase-orders"
            )
            return Response({'message': f"Reported product unavailability for PO '{po.request_number}'.", 'status': po.status})

        elif action == 'SUGGEST_DATE':
            suggested_date = request.data.get('suggested_delivery_date')
            if not suggested_date:
                return Response({'error': 'Please enter a proposed delivery date.'}, status=status.HTTP_400_BAD_REQUEST)

            po.supplier_suggested_delivery_date = suggested_date
            po.supplier_confirmation_notes = (po.supplier_confirmation_notes or '') + f"\n[Date Proposal]: Suggested delivery date {suggested_date}. Notes: {notes}"
            po.save(update_fields=['supplier_suggested_delivery_date', 'supplier_confirmation_notes', 'updated_at'])

            log_supplier_action(request.user, "PO_DATE_SUGGESTED", f"Supplier {supplier.name} suggested new delivery date {suggested_date} for PO {po.request_number}.", request)
            notify_store_and_admin(
                title=f"New Delivery Date Proposed for PO {po.request_number}",
                message=f"Supplier '{supplier.name}' proposed delivery date {suggested_date} for PO {po.request_number}.",
                link=f"/manager/procurement/purchase-orders"
            )
            return Response({'message': f"Proposed delivery date {suggested_date} submitted for store review.", 'suggested_delivery_date': str(po.supplier_suggested_delivery_date)})

        return Response(
            {'error': "Invalid action. Choose from ACCEPT, REJECT, PARTIAL, UNAVAILABLE, or SUGGEST_DATE."},
            status=status.HTTP_400_BAD_REQUEST
        )


# ============================================================================
# 4. SUPPLIER DELIVERY & DISPATCH UPDATES
# ============================================================================

class SupplierPurchaseOrderDeliveryUpdateView(views.APIView):
    """
    Supplier updates order preparation and logistics status:
    - PREPARING_ORDER: Processing and packaging in warehouse.
    - READY_FOR_DELIVERY: Staged and awaiting freight carrier pickup.
    - SHIPPED: Dispatched to logistics (requires carrier and optional tracking number).
    - DELIVERED: Reached EthioTech store receiving dock.
    Note: Inventory stock quantities do NOT update until Store Manager confirms physical inspection.
    """
    permission_classes = [IsAuthenticatedSupplier]

    def post(self, request, pk):
        supplier = request.user.supplier_profile
        po = get_object_or_404(PurchaseRequest, pk=pk, supplier=supplier)

        new_status = (request.data.get('status') or '').strip().upper()
        carrier = (request.data.get('carrier') or request.data.get('shipping_carrier') or '').strip()
        tracking_number = (request.data.get('tracking_number') or '').strip()
        notes = (request.data.get('notes') or '').strip()

        allowed_transitions = {
            'PREPARING_ORDER': [PurchaseRequest.Status.ACCEPTED, PurchaseRequest.Status.PARTIALLY_ACCEPTED],
            'READY_FOR_DELIVERY': [PurchaseRequest.Status.ACCEPTED, PurchaseRequest.Status.PARTIALLY_ACCEPTED, PurchaseRequest.Status.PREPARING_ORDER],
            'SHIPPED': [PurchaseRequest.Status.ACCEPTED, PurchaseRequest.Status.PARTIALLY_ACCEPTED, PurchaseRequest.Status.PREPARING_ORDER, PurchaseRequest.Status.READY_FOR_DELIVERY],
            'DELIVERED': [PurchaseRequest.Status.SHIPPED, PurchaseRequest.Status.READY_FOR_DELIVERY]
        }

        if new_status not in allowed_transitions:
            return Response(
                {'error': "Invalid status. Allowed transitions: PREPARING_ORDER, READY_FOR_DELIVERY, SHIPPED, DELIVERED."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if po.status not in allowed_transitions[new_status]:
            return Response(
                {'error': f"Cannot transition order from [{po.get_status_display()}] to [{new_status}]."},
                status=status.HTTP_400_BAD_REQUEST
            )

        po.status = getattr(PurchaseRequest.Status, new_status)
        if carrier:
            po.supplier_shipping_carrier = carrier
        if tracking_number:
            po.supplier_tracking_number = tracking_number
        if new_status == 'SHIPPED':
            po.supplier_dispatched_at = timezone.now()

        if notes:
            po.notes = (po.notes or '') + f"\n[{new_status}]: {notes}"

        po.save()

        log_supplier_action(
            request.user,
            f"PO_STATUS_{new_status}",
            f"Supplier {supplier.name} updated PO {po.request_number} to {new_status}. Carrier: {carrier}, Tracking: {tracking_number}",
            request
        )

        status_labels = {
            'PREPARING_ORDER': 'is being prepared in warehouse',
            'READY_FOR_DELIVERY': 'is ready for courier pickup',
            'SHIPPED': f'has been shipped via {carrier or "courier"}',
            'DELIVERED': 'has arrived at store receiving dock'
        }

        notify_store_and_admin(
            title=f"PO {po.request_number} Status: {new_status}",
            message=f"Supplier '{supplier.name}' updated PO {po.request_number}: Order {status_labels.get(new_status, new_status)}.",
            link=f"/manager/procurement/receive" if new_status in ['SHIPPED', 'DELIVERED'] else "/manager/procurement/purchase-orders"
        )

        return Response({
            'message': f"Order '{po.request_number}' updated to {po.get_status_display()}.",
            'status': po.status,
            'carrier': po.supplier_shipping_carrier,
            'tracking_number': po.supplier_tracking_number,
            'dispatched_at': str(po.supplier_dispatched_at) if po.supplier_dispatched_at else None
        })


# ============================================================================
# 5. SUPPLIER INVOICE MANAGEMENT
# ============================================================================

class SupplierPortalInvoiceListCreateView(views.APIView):
    """
    List and upload supplier invoices.
    Suppliers can submit invoices with supporting attachments.
    Admin review & approval remains mandatory before payment disbursement.
    """
    permission_classes = [IsAuthenticatedSupplier]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        supplier = request.user.supplier_profile
        invoices = SupplierInvoice.objects.filter(supplier=supplier).select_related(
            'purchase_order', 'submitted_by', 'reviewed_by'
        ).order_by('-created_at')

        from .serializers import SupplierInvoiceSerializer
        return Response(SupplierInvoiceSerializer(invoices, many=True).data)

    def post(self, request):
        supplier = request.user.supplier_profile
        data = request.data

        invoice_number = (data.get('invoice_number') or '').strip()
        if not invoice_number:
            return Response({'error': 'Invoice number is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Check invoice uniqueness per supplier
        if SupplierInvoice.objects.filter(supplier=supplier, invoice_number=invoice_number).exists():
            return Response({'error': f"An invoice with number '{invoice_number}' already exists for your account."}, status=status.HTTP_400_BAD_REQUEST)

        total_amount = data.get('total_amount') or data.get('amount')
        if not total_amount:
            return Response({'error': 'Invoice total amount is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            amt = Decimal(str(total_amount))
            if amt <= Decimal('0.00'):
                raise ValueError()
        except Exception:
            return Response({'error': 'Please enter a valid positive invoice amount in ETB.'}, status=status.HTTP_400_BAD_REQUEST)

        po = None
        po_id = data.get('purchase_order') or data.get('purchase_order_id')
        if po_id:
            po = PurchaseRequest.objects.filter(id=po_id, supplier=supplier).first()
            if not po:
                return Response({'error': 'Referenced purchase order not found or does not belong to your account.'}, status=status.HTTP_400_BAD_REQUEST)

        invoice_date = data.get('invoice_date') or timezone.now().date()
        due_date = data.get('due_date') or None
        notes = (data.get('notes') or '').strip()
        attachment = request.FILES.get('attachment')

        # Validate file size (max 10MB) and format
        if attachment:
            if attachment.size > 10 * 1024 * 1024:
                return Response({'error': 'Invoice attachment file size exceeds the 10MB limit.'}, status=status.HTTP_400_BAD_REQUEST)

        invoice = SupplierInvoice.objects.create(
            supplier=supplier,
            purchase_order=po,
            invoice_number=invoice_number,
            invoice_date=invoice_date,
            due_date=due_date,
            total_amount=amt,
            status=SupplierInvoice.Status.PENDING_APPROVAL,
            notes=notes,
            attachment=attachment,
            submitted_by=request.user
        )

        log_supplier_action(
            request.user,
            "INVOICE_SUBMITTED",
            f"Supplier {supplier.name} submitted Invoice {invoice.invoice_number} for ETB {invoice.total_amount}.",
            request
        )

        notify_store_and_admin(
            title=f"New Supplier Invoice: {invoice.invoice_number}",
            message=f"Supplier '{supplier.name}' uploaded Invoice #{invoice.invoice_number} for ETB {invoice.total_amount}. Awaiting Admin payment authorization.",
            link="/admin/procurement/invoices"
        )

        from .serializers import SupplierInvoiceSerializer
        return Response(SupplierInvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)


# ============================================================================
# 6. SUPPLIER PAYMENT HISTORY (READ-ONLY)
# ============================================================================

class SupplierPortalPaymentListView(generics.ListAPIView):
    """
    Read-only list of payment transactions and settlements for the authenticated supplier.
    Suppliers have strictly read-only visibility into approved & disbursed payments.
    """
    permission_classes = [IsAuthenticatedSupplier]

    def get_serializer_class(self):
        from .serializers import SupplierPaymentSerializer
        return SupplierPaymentSerializer

    def get_queryset(self):
        supplier = self.request.user.supplier_profile
        return SupplierPayment.objects.filter(supplier=supplier).select_related(
            'supplier', 'purchase_order', 'invoice', 'authorized_by'
        ).order_by('-payment_date')


# ============================================================================
# 7. SUPPLIER NOTIFICATIONS
# ============================================================================

class SupplierPortalNotificationListView(views.APIView):
    """
    Notifications addressed to the authenticated supplier user.
    """
    permission_classes = [IsAuthenticatedSupplier]

    def get(self, request):
        notifs = Notification.objects.filter(user=request.user).order_by('-created_at')[:30]
        data = [
            {
                'id': n.id,
                'title': n.title,
                'message': n.message,
                'notification_type': n.notification_type,
                'is_read': n.is_read,
                'link': n.link,
                'created_at': n.created_at
            }
            for n in notifs
        ]
        return Response(data)

    def post(self, request):
        # Mark all as read
        Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({'message': 'All supplier notifications marked as read.'})


# ============================================================================
# 8. ADMIN: CREATE / INVITE SUPPLIER LOGIN ACCOUNT
# ============================================================================

class AdminCreateSupplierAccountView(views.APIView):
    """
    Admin-only endpoint to provision or link a Supplier user account to a Supplier record.
    Unrestricted public supplier signup is prohibited.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        # Enforce Admin / Super Admin
        is_admin = getattr(request.user, 'is_admin', lambda: False)() or getattr(request.user, 'is_super_admin', False)
        if not is_admin:
            return Response(
                {'error': 'Permission Denied: Only platform Administrators can provision supplier accounts.'},
                status=status.HTTP_403_FORBIDDEN
            )

        supplier = get_object_or_404(Supplier, pk=pk)

        email = (request.data.get('email') or supplier.email or '').strip()
        try:
            email = validate_email_address(email, required=True)
        except Exception as err:
            err_msg = getattr(err, 'detail', str(err))
            if isinstance(err_msg, list):
                err_msg = err_msg[0]
            return Response({'error': str(err_msg)}, status=status.HTTP_400_BAD_REQUEST)

        phone = (request.data.get('phone') or supplier.phone or '').strip()
        formatted_phone = ''
        if phone:
            try:
                formatted_phone = validate_phone_number_format(phone, required=False)
            except Exception as err:
                err_msg = getattr(err, 'detail', str(err))
                if isinstance(err_msg, list):
                    err_msg = err_msg[0]
                return Response({'error': str(err_msg)}, status=status.HTTP_400_BAD_REQUEST)

        password = (request.data.get('password') or '').strip()
        if not password and not supplier.user:
            return Response({'error': 'Password is required to create a new supplier login account (min 6 chars).'}, status=status.HTTP_400_BAD_REQUEST)
        if password and len(password) < 6:
            return Response({'error': 'Password must be at least 6 characters long.'}, status=status.HTTP_400_BAD_REQUEST)

        username = (request.data.get('username') or '').strip()
        if not username:
            base_un = email.split('@')[0].replace('.', '_').replace('-', '_').lower()
            username = f"sup_{base_un}"

        # If supplier already has an account, update credentials
        if supplier.user:
            user = supplier.user
            user.email = email
            if formatted_phone:
                user.phone_number = formatted_phone
            if password:
                user.set_password(password)
                user.must_change_password = True
            user.save()

            supplier.email = email
            if formatted_phone:
                supplier.phone = formatted_phone
            supplier.save()

            log_supplier_action(request.user, "SUPPLIER_ACCOUNT_UPDATED", f"Admin updated login account for supplier '{supplier.name}' ({user.email}).", request)
            return Response({
                'message': f"Supplier account for '{supplier.name}' updated successfully.",
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'role': user.role
                }
            })

        # Check if user already exists by email
        existing_user = User.objects.filter(email__iexact=email).first()
        if existing_user:
            if existing_user.role not in [User.RoleChoices.CUSTOMER, User.RoleChoices.SUPPLIER]:
                return Response({'error': f"Account '{email}' is already an internal staff user ({existing_user.role}). Cannot convert to supplier."}, status=status.HTTP_400_BAD_REQUEST)
            if hasattr(existing_user, 'supplier_profile') and existing_user.supplier_profile and existing_user.supplier_profile.id != supplier.id:
                return Response({'error': f"Account '{email}' is already linked to another supplier ('{existing_user.supplier_profile.name}')."}, status=status.HTTP_400_BAD_REQUEST)

            # Link existing user
            existing_user.role = User.RoleChoices.SUPPLIER
            if password:
                existing_user.set_password(password)
            existing_user.email_verified = True
            existing_user.is_active = True
            existing_user.must_change_password = True
            existing_user.save()

            supplier.user = existing_user
            supplier.email = email
            if formatted_phone:
                supplier.phone = formatted_phone
            supplier.save()

            log_supplier_action(request.user, "SUPPLIER_ACCOUNT_LINKED", f"Admin linked existing account '{email}' to supplier '{supplier.name}'.", request)
            return Response({
                'message': f"Supplier login activated and linked to '{supplier.name}'.",
                'user': {
                    'id': existing_user.id,
                    'username': existing_user.username,
                    'email': existing_user.email,
                    'role': existing_user.role
                }
            })

        # Ensure unique username
        final_username = username
        counter = 1
        while User.objects.filter(username=final_username).exists():
            final_username = f"{username}_{counter}"
            counter += 1

        new_user = User.objects.create_user(
            username=final_username,
            email=email,
            password=password,
            first_name=supplier.contact_person or supplier.name,
            role=User.RoleChoices.SUPPLIER,
            phone_number=formatted_phone,
            email_verified=True,
            is_active=True,
            must_change_password=True
        )

        supplier.user = new_user
        supplier.email = email
        if formatted_phone:
            supplier.phone = formatted_phone
        supplier.save()

        log_supplier_action(request.user, "SUPPLIER_ACCOUNT_CREATED", f"Admin created new supplier login account for '{supplier.name}' ({new_user.email}).", request)
        return Response({
            'message': f"New supplier account for '{supplier.name}' created successfully.",
            'user': {
                'id': new_user.id,
                'username': new_user.username,
                'email': new_user.email,
                'role': new_user.role
            }
        }, status=status.HTTP_201_CREATED)

