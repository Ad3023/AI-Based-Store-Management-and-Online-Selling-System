import logging
from decimal import Decimal
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from accounts.models import AuditLog, User
from accounts.permissions import require_permission
from .models import Supplier, Product, RequestForQuotation, RFQItem, SupplierQuotation
from .rfq_serializers import RequestForQuotationSerializer

logger = logging.getLogger(__name__)


def notify_supplier_user(supplier, title, message, link="/supplier/quotations"):
    if supplier and getattr(supplier, 'user', None):
        try:
            from notifications.models import Notification
            Notification.objects.create(user=supplier.user, title=title, message=message, link=link)
        except Exception as e:
            logger.warning(f"Failed to notify supplier: {e}")


class RFQListCreateView(generics.ListCreateAPIView):
    """Store Manager lists and creates Requests for Quotation (RFQs)."""
    serializer_class = RequestForQuotationSerializer

    def get_permissions(self):
        return [require_permission('inventory.manage')()]

    def get_queryset(self):
        qs = RequestForQuotation.objects.all().select_related('supplier', 'created_by').prefetch_related('items__product', 'quotations__supplier').order_by('-created_at')
        sup_id = self.request.query_params.get('supplier_id')
        if sup_id:
            qs = qs.filter(supplier_id=sup_id)
        stat = self.request.query_params.get('status')
        if stat:
            qs = qs.filter(status=stat)
        return qs

    def create(self, request, *args, **kwargs):
        d = request.data
        sup_id = d.get('supplier')
        if not sup_id:
            return Response({'error': 'Supplier is required.'}, status=status.HTTP_400_BAD_REQUEST)
        supplier = Supplier.objects.filter(pk=sup_id).first()
        if not supplier:
            return Response({'error': 'Supplier not found.'}, status=status.HTTP_404_NOT_FOUND)

        items_data = d.get('items', [])
        if not items_data or not isinstance(items_data, list):
            return Response({'error': 'At least one product item is required for an RFQ.'}, status=status.HTTP_400_BAD_REQUEST)

        rfq = RequestForQuotation.objects.create(
            supplier=supplier,
            created_by=request.user,
            status=RequestForQuotation.Status.SENT,
            required_delivery_date=d.get('required_delivery_date') or None,
            notes=d.get('notes', ''),
            sent_at=timezone.now()
        )

        for it in items_data:
            prod_id = it.get('product') or it.get('product_id')
            prod = Product.objects.filter(pk=prod_id).first()
            if not prod:
                continue
            qty = max(1, int(it.get('requested_quantity') or 1))
            tgt = Decimal(str(it.get('target_price'))) if it.get('target_price') else None
            RFQItem.objects.create(rfq=rfq, product=prod, requested_quantity=qty, target_price=tgt, notes=it.get('notes', ''))

        notify_supplier_user(supplier, f"New RFQ: #{rfq.rfq_number}", f"Store Manager requested price quotation for {rfq.items.count()} products.")
        AuditLog.objects.create(user=request.user, action="RFQ_CREATED", details=f"Sent RFQ #{rfq.rfq_number} to {supplier.name}")
        return Response(RequestForQuotationSerializer(rfq).data, status=status.HTTP_201_CREATED)


class RFQDetailView(generics.RetrieveAPIView):
    queryset = RequestForQuotation.objects.all().select_related('supplier', 'created_by').prefetch_related('items__product', 'quotations__items__product')
    serializer_class = RequestForQuotationSerializer

    def get_permissions(self):
        return [require_permission('inventory.manage')()]


class QuotationComparisonView(APIView):
    """Compares quotations across suppliers for an RFQ or specific products."""
    def get_permissions(self):
        return [require_permission('inventory.manage')()]

    def get(self, request):
        rfq_id = request.query_params.get('rfq_id')
        prod_id = request.query_params.get('product_id')

        qs = SupplierQuotation.objects.all().select_related('supplier', 'rfq', 'submitted_by').prefetch_related('items__product')
        if rfq_id:
            qs = qs.filter(rfq_id=rfq_id)
        if prod_id:
            qs = qs.filter(items__product_id=prod_id).distinct()

        comparison = []
        for q in qs:
            for it in q.items.all():
                if prod_id and str(it.product_id) != str(prod_id):
                    continue
                comparison.append({
                    'quotation_id': q.id,
                    'quotation_number': q.quotation_number,
                    'rfq_id': q.rfq_id,
                    'rfq_number': q.rfq.rfq_number,
                    'supplier_id': q.supplier_id,
                    'supplier_name': q.supplier.name,
                    'product_id': it.product_id,
                    'product_name': it.product.name,
                    'requested_quantity': it.requested_quantity,
                    'offered_unit_price': str(it.offered_unit_price),
                    'available_quantity': it.available_quantity,
                    'line_total': str(it.line_total),
                    'total_quotation_amount': str(q.total_amount),
                    'delivery_lead_time': q.delivery_lead_time,
                    'estimated_delivery_date': q.estimated_delivery_date,
                    'payment_terms': q.payment_terms,
                    'quotation_status': q.status,
                    'submission_date': q.created_at,
                    'notes': q.notes or it.notes,
                })
        return Response(comparison)
