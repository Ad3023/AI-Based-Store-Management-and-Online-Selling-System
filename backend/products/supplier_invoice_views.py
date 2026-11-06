import logging
from decimal import Decimal
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from accounts.models import AuditLog
from accounts.permissions import require_permission
from .procurement_base import is_admin_user
from .models import Supplier, PurchaseRequest, SupplierInvoice
from .serializers import SupplierInvoiceSerializer

logger = logging.getLogger(__name__)


def notify_supplier(supplier, title, message):
    if supplier and getattr(supplier, 'user', None):
        try:
            from notifications.models import Notification
            Notification.objects.create(user=supplier.user, title=title, message=message, link="/supplier/invoices")
        except Exception as e:
            logger.warning(f"Failed to notify supplier: {e}")


def notify_admins(title, message, link="/admin/procurement/invoices"):
    try:
        from accounts.models import User
        from django.db.models import Q
        from notifications.models import Notification
        admins = User.objects.filter(
            Q(role__in=[User.RoleChoices.ADMIN, User.RoleChoices.SUPER_ADMIN]) | Q(is_superuser=True), is_active=True
        ).distinct()
        for a in admins:
            Notification.objects.create(user=a, title=title, message=message, link=link)
    except Exception as e:
        logger.warning(f"Failed to notify admins: {e}")


class SupplierInvoiceListCreateView(generics.ListCreateAPIView):
    """Lists invoices and allows store managers to record invoices against POs."""
    serializer_class = SupplierInvoiceSerializer

    def get_permissions(self):
        return [require_permission('inventory.manage')()]

    def get_queryset(self):
        qs = SupplierInvoice.objects.all().select_related(
            'supplier', 'purchase_order', 'submitted_by', 'verified_by_store',
            'reviewed_by', 'approved_by_admin'
        ).order_by('-created_at')
        for param, field in [('supplier_id', 'supplier_id'), ('purchase_order_id', 'purchase_order_id'), ('status', 'status')]:
            val = self.request.query_params.get(param)
            if val:
                qs = qs.filter(**{field: val})
        return qs

    def create(self, request, *args, **kwargs):
        d = request.data
        sup_id, inv_num = d.get('supplier'), (d.get('invoice_number') or '').strip()
        if not sup_id or not inv_num:
            return Response({'error': 'Supplier and invoice number are required.'}, status=status.HTTP_400_BAD_REQUEST)

        if SupplierInvoice.objects.filter(supplier_id=sup_id, invoice_number__iexact=inv_num).exists():
            return Response({'error': f"Duplicate Invoice Detected: An invoice with number '{inv_num}' already exists for this supplier."}, status=status.HTTP_400_BAD_REQUEST)

        supplier = Supplier.objects.filter(pk=sup_id).first()
        if not supplier:
            return Response({'error': 'Supplier not found.'}, status=status.HTTP_404_NOT_FOUND)

        po = PurchaseRequest.objects.filter(pk=d.get('purchase_order')).first() if d.get('purchase_order') else None
        inv_qty = int(d.get('invoiced_quantity') or (po.accepted_quantity if po else 1))
        unit_price = Decimal(str(d.get('unit_price') or (po.agreed_price if po else '0.00')))
        subtotal = inv_qty * unit_price
        tax = Decimal(str(d.get('tax_amount') or '0.00'))
        total = Decimal(str(d.get('total_amount') or (subtotal + tax)))

        inv = SupplierInvoice.objects.create(
            supplier=supplier, purchase_order=po, invoice_number=inv_num,
            invoice_date=d.get('invoice_date') or timezone.now().date(),
            due_date=d.get('due_date') or None,
            ordered_quantity=po.quantity if po else inv_qty,
            delivered_quantity=po.received_quantity if po else inv_qty,
            accepted_quantity=po.accepted_quantity if po else inv_qty,
            invoiced_quantity=inv_qty, unit_price=unit_price,
            subtotal=subtotal, tax_amount=tax, total_amount=total,
            notes=d.get('notes', ''), attachment=request.FILES.get('attachment'),
            submitted_by=request.user, status=SupplierInvoice.Status.PENDING_APPROVAL
        )
        AuditLog.objects.create(user=request.user, action="SUPPLIER_INVOICE_SUBMITTED",
                                details=f"Invoice #{inv.invoice_number} submitted for {supplier.name} (ETB {inv.total_amount})")
        return Response(self.get_serializer(inv).data, status=status.HTTP_201_CREATED)


class SupplierInvoiceDetailView(generics.RetrieveAPIView):
    queryset = SupplierInvoice.objects.all()
    serializer_class = SupplierInvoiceSerializer

    def get_permissions(self):
        return [require_permission('inventory.manage')()]


class SupplierInvoiceStoreVerifyView(APIView):
    """Store Manager verifies invoice against PO and physical accepted quantities."""
    def get_permissions(self):
        return [require_permission('inventory.manage')()]

    def post(self, request, pk):
        user = request.user
        inv = SupplierInvoice.objects.select_related('supplier', 'purchase_order').filter(pk=pk).first()
        if not inv:
            return Response({'error': 'Invoice not found.'}, status=status.HTTP_404_NOT_FOUND)

        act = request.data.get('action') # 'verify' or 'reject'
        notes = (request.data.get('notes') or request.data.get('rejection_reason') or '').strip()

        if act == 'verify':
            inv.status = SupplierInvoice.Status.PENDING_ADMIN_APPROVAL
            inv.verified_by_store = user
            inv.store_verified_at = timezone.now()
            inv.store_verification_notes = notes
            inv.save()
            notify_admins(f"Invoice Verified: #{inv.invoice_number}",
                          f"Store Manager {user.username} verified invoice #{inv.invoice_number} ({inv.supplier.name}). Awaiting Admin payment approval.")
            AuditLog.objects.create(user=user, action="SUPPLIER_INVOICE_STORE_VERIFIED",
                                    details=f"Store Manager {user.username} verified invoice #{inv.invoice_number}")
            return Response({'success': True, 'message': f"Invoice #{inv.invoice_number} verified and forwarded to Admin.", 'invoice': SupplierInvoiceSerializer(inv).data})

        elif act == 'reject':
            if not notes:
                return Response({'error': 'Rejection reason is required.'}, status=status.HTTP_400_BAD_REQUEST)
            inv.status = SupplierInvoice.Status.REJECTED_BY_STORE
            inv.rejection_reason = notes
            inv.verified_by_store = user
            inv.store_verified_at = timezone.now()
            inv.store_verification_notes = notes
            inv.save()
            notify_supplier(inv.supplier, f"Invoice #{inv.invoice_number} Rejected by Store",
                            f"Your invoice #{inv.invoice_number} was rejected by Store Manager. Reason: {notes}")
            AuditLog.objects.create(user=user, action="SUPPLIER_INVOICE_STORE_REJECTED",
                                    details=f"Store Manager {user.username} rejected invoice #{inv.invoice_number}. Reason: {notes}")
            return Response({'success': True, 'message': f"Invoice #{inv.invoice_number} rejected.", 'invoice': SupplierInvoiceSerializer(inv).data})

        return Response({'error': "Invalid action. Expected 'verify' or 'reject'."}, status=status.HTTP_400_BAD_REQUEST)


class SupplierInvoiceReviewView(APIView):
    """Admin reviews and approves or rejects supplier invoices for external payment disbursement."""
    def get_permissions(self):
        return [require_permission('settlements.manage')()]

    def post(self, request, pk):
        user = request.user
        if not is_admin_user(user):
            return Response({'error': 'Permission Denied: Only Administrators can review and approve invoices for payment.'}, status=status.HTTP_403_FORBIDDEN)

        inv = SupplierInvoice.objects.select_related('supplier', 'purchase_order').filter(pk=pk).first()
        if not inv:
            return Response({'error': 'Invoice not found.'}, status=status.HTTP_404_NOT_FOUND)

        act = request.data.get('action') # 'approve' or 'reject'
        notes = (request.data.get('review_notes') or request.data.get('rejection_reason') or '').strip()

        if act == 'approve':
            inv.status = SupplierInvoice.Status.APPROVED_FOR_PAYMENT
            inv.approved_by_admin = user
            inv.admin_approved_at = timezone.now()
            inv.admin_review_notes = notes
            inv.reviewed_by = user
            inv.reviewed_at = timezone.now()
            inv.review_notes = notes
            inv.save()
            notify_supplier(inv.supplier, f"Invoice #{inv.invoice_number} Approved for Payment",
                            f"Your invoice #{inv.invoice_number} (ETB {inv.total_amount}) has been approved for bank payment.")
            AuditLog.objects.create(user=user, action="SUPPLIER_INVOICE_APPROVED",
                                    details=f"Admin {user.username} approved invoice #{inv.invoice_number} for payment (ETB {inv.total_amount})")
            return Response({'success': True, 'message': f"Invoice #{inv.invoice_number} approved for payment.", 'invoice': SupplierInvoiceSerializer(inv).data})

        elif act == 'reject':
            if not notes:
                return Response({'error': 'Rejection reason is required.'}, status=status.HTTP_400_BAD_REQUEST)
            inv.status = SupplierInvoice.Status.REJECTED_BY_ADMIN
            inv.rejection_reason = notes
            inv.approved_by_admin = user
            inv.admin_approved_at = timezone.now()
            inv.admin_review_notes = notes
            inv.reviewed_by = user
            inv.reviewed_at = timezone.now()
            inv.review_notes = notes
            inv.save()
            notify_supplier(inv.supplier, f"Invoice #{inv.invoice_number} Rejected by Admin",
                            f"Your invoice #{inv.invoice_number} was rejected by Admin. Reason: {notes}")
            AuditLog.objects.create(user=user, action="SUPPLIER_INVOICE_REJECTED",
                                    details=f"Admin {user.username} rejected invoice #{inv.invoice_number}. Reason: {notes}")
            return Response({'success': True, 'message': f"Invoice #{inv.invoice_number} rejected.", 'invoice': SupplierInvoiceSerializer(inv).data})

        return Response({'error': "Invalid action. Expected 'approve' or 'reject'."}, status=status.HTTP_400_BAD_REQUEST)
