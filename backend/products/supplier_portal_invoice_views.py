import logging
from decimal import Decimal
from django.utils import timezone
from rest_framework import views, generics, status
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from accounts.models import AuditLog
from .models import PurchaseRequest, SupplierInvoice, SupplierPayment
from .serializers import SupplierInvoiceSerializer, SupplierPaymentSerializer
from .supplier_portal_views import IsAuthenticatedSupplier, log_supplier_action, notify_store_and_admin

logger = logging.getLogger(__name__)


class SupplierPortalInvoiceListCreateView(views.APIView):
    """
    Suppliers list submitted invoices and submit final invoices against accepted POs.
    Prevents billing unaccepted goods and enforces unique invoice numbers.
    """
    permission_classes = [IsAuthenticatedSupplier]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        supplier = request.user.supplier_profile
        if request.query_params.get('eligible_pos'):
            # Return POs with accepted quantities ready for final invoice
            pos = PurchaseRequest.objects.filter(
                supplier=supplier
            ).exclude(status__in=[PurchaseRequest.Status.DRAFT, PurchaseRequest.Status.CANCELLED, PurchaseRequest.Status.REJECTED]).order_by('-created_at')
            eligible = []
            for p in pos:
                acc_qty = p.accepted_quantity
                if acc_qty > 0:
                    eligible.append({
                        'id': p.id,
                        'request_number': p.request_number,
                        'product_name': p.product.name if p.product else 'Multiple Products',
                        'ordered_quantity': p.quantity,
                        'delivered_quantity': p.received_quantity,
                        'accepted_quantity': acc_qty,
                        'unit_price': str(p.agreed_price or p.estimated_unit_cost or '0.00'),
                        'total_estimated_cost': str(p.total_estimated_cost or '0.00'),
                        'status': p.status
                    })
            return Response(eligible)

        invoices = SupplierInvoice.objects.filter(supplier=supplier).select_related(
            'purchase_order', 'submitted_by', 'verified_by_store', 'approved_by_admin'
        ).order_by('-created_at')
        return Response(SupplierInvoiceSerializer(invoices, many=True).data)

    def post(self, request):
        supplier = request.user.supplier_profile
        d = request.data

        inv_num = (d.get('invoice_number') or '').strip()
        if not inv_num:
            return Response({'error': 'Invoice number is required.'}, status=status.HTTP_400_BAD_REQUEST)

        if SupplierInvoice.objects.filter(supplier=supplier, invoice_number__iexact=inv_num).exists():
            return Response({'error': f"Duplicate Invoice: You already submitted invoice #{inv_num}."}, status=status.HTTP_400_BAD_REQUEST)

        po_id = d.get('purchase_order') or d.get('purchase_order_id')
        if not po_id:
            return Response({'error': 'Purchase order reference is required.'}, status=status.HTTP_400_BAD_REQUEST)

        po = PurchaseRequest.objects.filter(id=po_id, supplier=supplier).first()
        if not po:
            return Response({'error': 'Purchase order not found or does not belong to your account.'}, status=status.HTTP_404_NOT_FOUND)

        acc_qty = po.accepted_quantity
        if acc_qty <= 0:
            return Response({'error': 'Cannot submit invoice: No accepted goods recorded for this purchase order yet.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            inv_qty = int(d.get('invoiced_quantity') or acc_qty)
            if inv_qty <= 0:
                raise ValueError()
        except Exception:
            return Response({'error': 'Invoiced quantity must be a positive integer.'}, status=status.HTTP_400_BAD_REQUEST)

        if inv_qty > acc_qty:
            return Response({'error': f"Invoiced quantity ({inv_qty}) cannot exceed store-accepted quantity ({acc_qty})."}, status=status.HTTP_400_BAD_REQUEST)

        unit_price = Decimal(str(d.get('unit_price') or (po.agreed_price or po.estimated_unit_cost or '0.00')))
        if unit_price <= Decimal('0.00'):
            return Response({'error': 'Unit price must be greater than zero.'}, status=status.HTTP_400_BAD_REQUEST)

        tax_amt = Decimal(str(d.get('tax_amount') or '0.00'))
        subtotal = inv_qty * unit_price
        total_amt = subtotal + tax_amt

        attachment = request.FILES.get('attachment')
        if attachment and attachment.size > 10 * 1024 * 1024:
            return Response({'error': 'Invoice attachment exceeds the 10MB limit.'}, status=status.HTTP_400_BAD_REQUEST)

        inv = SupplierInvoice.objects.create(
            supplier=supplier,
            purchase_order=po,
            invoice_number=inv_num,
            invoice_date=d.get('invoice_date') or timezone.now().date(),
            due_date=d.get('due_date') or None,
            ordered_quantity=po.quantity,
            delivered_quantity=po.received_quantity,
            accepted_quantity=acc_qty,
            invoiced_quantity=inv_qty,
            unit_price=unit_price,
            subtotal=subtotal,
            tax_amount=tax_amt,
            total_amount=total_amt,
            status=SupplierInvoice.Status.SUBMITTED,
            notes=(d.get('notes') or '').strip(),
            attachment=attachment,
            submitted_by=request.user
        )

        log_supplier_action(
            request.user,
            "INVOICE_SUBMITTED",
            f"Supplier {supplier.name} submitted invoice #{inv.invoice_number} for PO {po.request_number} (Accepted: {acc_qty}, Invoiced: {inv_qty}, Total: ETB {total_amt})",
            request
        )

        notify_store_and_admin(
            title=f"New Supplier Invoice Submitted: #{inv.invoice_number}",
            message=f"Supplier '{supplier.name}' submitted final invoice #{inv.invoice_number} (ETB {inv.total_amount}) for PO {po.request_number}. Ready for store verification.",
            link="/admin/procurement/invoices"
        )

        return Response(SupplierInvoiceSerializer(inv).data, status=status.HTTP_201_CREATED)


class SupplierPortalPaymentListView(generics.ListAPIView):
    """
    Read-only list of payment transactions and manual bank settlements for the authenticated supplier.
    """
    permission_classes = [IsAuthenticatedSupplier]
    serializer_class = SupplierPaymentSerializer

    def get_queryset(self):
        supplier = self.request.user.supplier_profile
        return SupplierPayment.objects.filter(supplier=supplier).select_related(
            'supplier', 'purchase_order', 'invoice', 'authorized_by'
        ).order_by('-payment_date')
