import logging
from decimal import Decimal
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from accounts.models import AuditLog
from accounts.permissions import require_permission
from .procurement_base import is_admin_user
from .models import Supplier, PurchaseRequest, SupplierInvoice, SupplierPayment
from .serializers import SupplierPaymentSerializer

logger = logging.getLogger(__name__)


def notify_supplier_payment(supplier, payment, invoice):
    if supplier and getattr(supplier, 'user', None):
        try:
            from notifications.models import Notification
            Notification.objects.create(
                user=supplier.user,
                title=f"Payment Recorded: Ref {payment.transaction_reference}",
                message=(
                    f"Admin recorded a manual bank payment of ETB {payment.amount_paid} "
                    f"for Invoice #{invoice.invoice_number if invoice else 'N/A'}. "
                    f"Remaining balance: ETB {invoice.outstanding_amount if invoice else '0.00'}."
                ),
                link="/supplier/payments"
            )
        except Exception as e:
            logger.warning(f"Failed to notify supplier of payment: {e}")


class SupplierPaymentListCreateView(generics.ListCreateAPIView):
    """
    Lists payment records and allows authorized Admin to record external manual bank settlements.
    Store Managers are strictly forbidden from authorizing or recording disbursements.
    """
    serializer_class = SupplierPaymentSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.request.method == 'POST':
            return [require_permission('settlements.manage')()]
        return [require_permission('inventory.manage')()]

    def get_queryset(self):
        qs = SupplierPayment.objects.all().select_related(
            'supplier', 'purchase_order', 'invoice', 'authorized_by'
        ).order_by('-payment_date')
        for param, field in [('supplier_id', 'supplier_id'), ('invoice_id', 'invoice_id'),
                             ('purchase_order_id', 'purchase_order_id'), ('status', 'payment_status')]:
            val = self.request.query_params.get(param)
            if val:
                qs = qs.filter(**{field: val})
        return qs

    def create(self, request, *args, **kwargs):
        user = request.user
        if not is_admin_user(user) or getattr(user, 'role', '') == 'store_manager':
            return Response(
                {'error': 'Permission Denied: Store Managers cannot authorize or record payments. Admin authorization required.'},
                status=status.HTTP_403_FORBIDDEN
            )

        data = request.data
        inv_id = data.get('invoice') or data.get('invoice_id')
        sup_id = data.get('supplier')
        amount_paid = Decimal(str(data.get('amount_paid') or '0.00'))

        if amount_paid <= Decimal('0.00'):
            return Response({'error': 'Payment amount must be greater than zero.'}, status=status.HTTP_400_BAD_REQUEST)

        invoice = None
        if inv_id:
            invoice = SupplierInvoice.objects.filter(pk=inv_id).select_related('supplier', 'purchase_order').first()
            if not invoice:
                return Response({'error': 'Referenced invoice not found.'}, status=status.HTTP_404_NOT_FOUND)
            if invoice.status not in [SupplierInvoice.Status.APPROVED_FOR_PAYMENT, SupplierInvoice.Status.APPROVED, SupplierInvoice.Status.PARTIALLY_PAID]:
                return Response({'error': f"Invoice #{invoice.invoice_number} is not approved for payment (Status: {invoice.status})."}, status=status.HTTP_400_BAD_REQUEST)
            if amount_paid > invoice.outstanding_amount:
                return Response({'error': f"Payment amount (ETB {amount_paid}) exceeds invoice outstanding balance (ETB {invoice.outstanding_amount})."}, status=status.HTTP_400_BAD_REQUEST)
            supplier = invoice.supplier
        elif sup_id:
            supplier = Supplier.objects.filter(pk=sup_id).first()
            if not supplier:
                return Response({'error': 'Supplier not found.'}, status=status.HTTP_404_NOT_FOUND)
        else:
            return Response({'error': 'Invoice or Supplier is required.'}, status=status.HTTP_400_BAD_REQUEST)

        tx_ref = (data.get('transaction_reference') or '').strip()
        if tx_ref and SupplierPayment.objects.filter(transaction_reference__iexact=tx_ref).exists():
            return Response({'error': f"Duplicate Payment Reference: A payment with reference '{tx_ref}' already exists in the system."}, status=status.HTTP_400_BAD_REQUEST)

        po = invoice.purchase_order if (invoice and invoice.purchase_order) else (
            PurchaseRequest.objects.filter(pk=data.get('purchase_order')).first() if data.get('purchase_order') else None
        )

        total_amount = invoice.total_amount if invoice else (po.total_estimated_cost if po else amount_paid)
        payment_date = data.get('payment_date') or timezone.now()
        bank_name = data.get('bank_name') or supplier.bank_name
        bank_acc = data.get('bank_account_number') or supplier.bank_account_number
        receipt = request.FILES.get('receipt')

        payment = SupplierPayment.objects.create(
            supplier=supplier,
            invoice=invoice,
            purchase_order=po,
            supplier_invoice=invoice.invoice_number if invoice else (data.get('supplier_invoice') or ''),
            purchase_order_reference=po.request_number if po else (data.get('purchase_order_reference') or ''),
            total_purchase_amount=total_amount,
            amount_paid=amount_paid,
            payment_method=data.get('payment_method') or SupplierPayment.PaymentMethod.BANK_TRANSFER,
            transaction_reference=tx_ref,
            payment_date=payment_date,
            payment_status=SupplierPayment.PaymentStatus.PAID,
            authorized_by=user,
            receipt=receipt,
            bank_name=bank_name,
            bank_account_number=bank_acc,
            notes=data.get('notes', '')
        )

        # Update invoice balance and status
        if invoice:
            invoice.paid_amount += amount_paid
            if invoice.paid_amount >= invoice.total_amount:
                invoice.status = SupplierInvoice.Status.PAID
            else:
                invoice.status = SupplierInvoice.Status.PARTIALLY_PAID
            invoice.save()

        notify_supplier_payment(supplier, payment, invoice)

        AuditLog.objects.create(
            user=user,
            action="SUPPLIER_PAYMENT_AUTHORIZED",
            details=f"Admin {user.username} recorded payment of ETB {payment.amount_paid} to {supplier.name} via Bank Transfer (Ref: {payment.transaction_reference})"
        )

        return Response(self.get_serializer(payment).data, status=status.HTTP_201_CREATED)


class SupplierPaymentDetailView(generics.RetrieveUpdateAPIView):
    queryset = SupplierPayment.objects.all()
    serializer_class = SupplierPaymentSerializer

    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH']:
            return [require_permission('settlements.manage')()]
        return [require_permission('inventory.manage')()]
