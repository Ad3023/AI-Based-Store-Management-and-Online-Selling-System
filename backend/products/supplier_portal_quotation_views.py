import logging
from decimal import Decimal
from django.utils import timezone
from rest_framework import views, generics, status
from rest_framework.response import Response
from accounts.models import AuditLog, User
from .models import Supplier, Product, RequestForQuotation, RFQItem, SupplierQuotation, SupplierQuotationItem
from .rfq_serializers import RequestForQuotationSerializer, SupplierQuotationSerializer
from .supplier_portal_views import IsAuthenticatedSupplier, log_supplier_action, notify_store_and_admin

logger = logging.getLogger(__name__)


class SupplierPortalRFQListView(generics.ListAPIView):
    """Lists quotation requests strictly addressed to the authenticated supplier."""
    permission_classes = [IsAuthenticatedSupplier]
    serializer_class = RequestForQuotationSerializer

    def get_queryset(self):
        supplier = self.request.user.supplier_profile
        return RequestForQuotation.objects.filter(supplier=supplier).exclude(
            status=RequestForQuotation.Status.DRAFT
        ).prefetch_related('items__product', 'quotations__items__product').order_by('-created_at')


class SupplierPortalRFQDetailView(views.APIView):
    """Retrieves RFQ details (auto-marks viewed) or declines an RFQ."""
    permission_classes = [IsAuthenticatedSupplier]

    def get(self, request, pk):
        supplier = request.user.supplier_profile
        rfq = RequestForQuotation.objects.filter(pk=pk, supplier=supplier).prefetch_related('items__product', 'quotations__items__product').first()
        if not rfq:
            return Response({'error': 'Quotation request not found or does not belong to your account.'}, status=status.HTTP_404_NOT_FOUND)

        if rfq.status == RequestForQuotation.Status.SENT:
            rfq.status = RequestForQuotation.Status.VIEWED
            rfq.viewed_at = timezone.now()
            rfq.save(update_fields=['status', 'viewed_at'])

        return Response(RequestForQuotationSerializer(rfq).data)

    def post(self, request, pk):
        supplier = request.user.supplier_profile
        rfq = RequestForQuotation.objects.filter(pk=pk, supplier=supplier).first()
        if not rfq:
            return Response({'error': 'Quotation request not found.'}, status=status.HTTP_404_NOT_FOUND)

        act = request.data.get('action')
        if act == 'decline':
            reason = (request.data.get('decline_reason') or request.data.get('notes') or '').strip()
            rfq.status = RequestForQuotation.Status.DECLINED
            rfq.decline_reason = reason
            rfq.save(update_fields=['status', 'decline_reason', 'updated_at'])

            notify_store_and_admin(
                title=f"RFQ #{rfq.rfq_number} Declined",
                message=f"Supplier '{supplier.name}' declined RFQ #{rfq.rfq_number}. Reason: {reason or 'Not specified.'}",
                link="/manager/procurement/rfqs"
            )
            log_supplier_action(request.user, "RFQ_DECLINED", f"Declined RFQ #{rfq.rfq_number}. Reason: {reason}", request)
            return Response({'message': f"RFQ #{rfq.rfq_number} declined.", 'rfq': RequestForQuotationSerializer(rfq).data})

        return Response({'error': "Invalid action. Expected 'decline'."}, status=status.HTTP_400_BAD_REQUEST)


class SupplierPortalQuotationListCreateView(views.APIView):
    """Lists submitted quotations and submits price quotations against an RFQ."""
    permission_classes = [IsAuthenticatedSupplier]

    def get(self, request):
        supplier = request.user.supplier_profile
        quotations = SupplierQuotation.objects.filter(supplier=supplier).select_related('rfq', 'purchase_order').prefetch_related('items__product').order_by('-created_at')
        return Response(SupplierQuotationSerializer(quotations, many=True).data)

    def post(self, request):
        supplier = request.user.supplier_profile
        d = request.data

        rfq_id = d.get('rfq') or d.get('rfq_id')
        if not rfq_id:
            return Response({'error': 'RFQ reference is required.'}, status=status.HTTP_400_BAD_REQUEST)

        rfq = RequestForQuotation.objects.filter(id=rfq_id, supplier=supplier).prefetch_related('items').first()
        if not rfq:
            return Response({'error': 'Quotation request not found or does not belong to your account.'}, status=status.HTTP_404_NOT_FOUND)

        if rfq.status in [RequestForQuotation.Status.DECLINED, RequestForQuotation.Status.EXPIRED, RequestForQuotation.Status.CANCELLED]:
            return Response({'error': f"Cannot quote for RFQ in status {rfq.status}."}, status=status.HTTP_400_BAD_REQUEST)

        items_payload = d.get('items', [])
        if not items_payload or not isinstance(items_payload, list):
            return Response({'error': 'Quotation items with offered unit prices are required.'}, status=status.HTTP_400_BAD_REQUEST)

        total_amount = Decimal('0.00')
        valid_items = []

        for it_data in items_payload:
            prod_id = it_data.get('product') or it_data.get('product_id')
            prod = Product.objects.filter(pk=prod_id).first()
            if not prod:
                continue

            try:
                unit_price = Decimal(str(it_data.get('offered_unit_price') or '0.00'))
                if unit_price <= Decimal('0.00'):
                    raise ValueError()
            except Exception:
                return Response({'error': f"Please enter a valid positive unit price for {prod.name}."}, status=status.HTTP_400_BAD_REQUEST)

            req_qty = max(1, int(it_data.get('requested_quantity') or 1))
            avail_qty = max(1, int(it_data.get('available_quantity') or req_qty))
            line_tot = unit_price * req_qty
            total_amount += line_tot

            rfq_item_id = it_data.get('rfq_item') or it_data.get('rfq_item_id')
            rfq_item = RFQItem.objects.filter(pk=rfq_item_id, rfq=rfq).first() if rfq_item_id else None

            valid_items.append({
                'product': prod,
                'rfq_item': rfq_item,
                'requested_quantity': req_qty,
                'offered_unit_price': unit_price,
                'available_quantity': avail_qty,
                'line_total': line_tot,
                'notes': it_data.get('notes', '')
            })

        if not valid_items:
            return Response({'error': 'At least one valid quoted product item is required.'}, status=status.HTTP_400_BAD_REQUEST)

        quotation = SupplierQuotation.objects.create(
            rfq=rfq,
            supplier=supplier,
            submitted_by=request.user,
            status=SupplierQuotation.Status.SUBMITTED,
            total_amount=total_amount,
            delivery_lead_time=d.get('delivery_lead_time', ''),
            estimated_delivery_date=d.get('estimated_delivery_date') or None,
            payment_terms=d.get('payment_terms') or 'Bank transfer after delivery',
            valid_until=d.get('valid_until') or None,
            notes=d.get('notes', '')
        )

        for v in valid_items:
            SupplierQuotationItem.objects.create(
                quotation=quotation,
                rfq_item=v['rfq_item'],
                product=v['product'],
                requested_quantity=v['requested_quantity'],
                offered_unit_price=v['offered_unit_price'],
                available_quantity=v['available_quantity'],
                line_total=v['line_total'],
                notes=v['notes']
            )

        rfq.status = RequestForQuotation.Status.RESPONDED
        rfq.responded_at = timezone.now()
        rfq.save(update_fields=['status', 'responded_at', 'updated_at'])

        log_supplier_action(request.user, "QUOTATION_SUBMITTED", f"Submitted Quotation #{quotation.quotation_number} (ETB {total_amount}) for RFQ #{rfq.rfq_number}", request)
        notify_store_and_admin(
            title=f"Quotation Received: #{quotation.quotation_number}",
            message=f"Supplier '{supplier.name}' submitted Quotation #{quotation.quotation_number} (ETB {quotation.total_amount}) for RFQ #{rfq.rfq_number}.",
            link="/manager/procurement/rfqs"
        )

        return Response(SupplierQuotationSerializer(quotation).data, status=status.HTTP_201_CREATED)

