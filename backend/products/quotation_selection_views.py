import logging
from decimal import Decimal
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from accounts.models import AuditLog, User
from accounts.permissions import require_permission
from .models import SupplierQuotation, PurchaseRequest, PurchaseOrderItem
from .rfq_serializers import SupplierQuotationSerializer
from .serializers import PurchaseRequestSerializer

logger = logging.getLogger(__name__)


def notify_supplier_user(supplier, title, message, link="/supplier/quotations"):
    if supplier and getattr(supplier, 'user', None):
        try:
            from notifications.models import Notification
            Notification.objects.create(user=supplier.user, title=title, message=message, link=link)
        except Exception as e:
            logger.warning(f"Failed to notify supplier: {e}")


def notify_admins(title, message, link="/admin/procurement/approvals"):
    try:
        from notifications.models import Notification
        from django.db.models import Q
        admins = User.objects.filter(
            Q(role__in=[User.RoleChoices.ADMIN, User.RoleChoices.SUPER_ADMIN]) | Q(is_superuser=True),
            is_active=True
        ).distinct()
        for a in admins:
            Notification.objects.create(user=a, title=title, message=message, link=link)
    except Exception as e:
        logger.warning(f"Failed to notify admins: {e}")


class QuotationSelectView(APIView):
    """Store Manager selects a winning quotation."""
    def get_permissions(self):
        return [require_permission('inventory.manage')()]

    def post(self, request, pk):
        quotation = SupplierQuotation.objects.select_related('supplier', 'rfq').filter(pk=pk).first()
        if not quotation:
            return Response({'error': 'Quotation not found.'}, status=status.HTTP_404_NOT_FOUND)

        quotation.status = SupplierQuotation.Status.SELECTED
        quotation.selected_by = request.user
        quotation.selected_at = timezone.now()
        quotation.selection_notes = request.data.get('selection_notes', '')
        quotation.save()

        # Mark other quotations for this RFQ as NOT_SELECTED
        SupplierQuotation.objects.filter(rfq=quotation.rfq).exclude(pk=quotation.pk).update(status=SupplierQuotation.Status.NOT_SELECTED)

        notify_supplier_user(
            quotation.supplier,
            f"Quotation Selected: #{quotation.quotation_number}",
            f"Your quotation #{quotation.quotation_number} (ETB {quotation.total_amount}) has been selected! A Purchase Order will be issued."
        )
        AuditLog.objects.create(user=request.user, action="QUOTATION_SELECTED", details=f"Selected Quotation #{quotation.quotation_number} from {quotation.supplier.name}")
        return Response({'message': f"Quotation #{quotation.quotation_number} selected successfully.", 'quotation': SupplierQuotationSerializer(quotation).data})


class ConvertQuotationToPOView(APIView):
    """Generates an official Purchase Order using the supplier's quoted prices."""
    def get_permissions(self):
        return [require_permission('inventory.manage')()]

    def post(self, request, pk):
        quotation = SupplierQuotation.objects.select_related('supplier', 'rfq').prefetch_related('items__product').filter(pk=pk).first()
        if not quotation:
            return Response({'error': 'Quotation not found.'}, status=status.HTTP_404_NOT_FOUND)
        if quotation.purchase_order:
            return Response({'error': f"A Purchase Order ({quotation.purchase_order.request_number}) was already generated from this quotation."}, status=status.HTTP_400_BAD_REQUEST)

        first_item = quotation.items.first()
        pr = PurchaseRequest.objects.create(
            supplier=quotation.supplier,
            quotation=quotation,
            product=first_item.product if first_item else None,
            quantity=sum(it.requested_quantity for it in quotation.items.all()),
            total_estimated_cost=quotation.total_amount,
            estimated_unit_cost=first_item.offered_unit_price if first_item else Decimal('0.00'),
            agreed_price=first_item.offered_unit_price if first_item else Decimal('0.00'),
            expected_supply_date=quotation.estimated_delivery_date,
            status=PurchaseRequest.Status.PENDING_APPROVAL,
            requested_by=request.user,
            notes=f"Generated from Quotation #{quotation.quotation_number}. Payment Terms: {quotation.payment_terms}. {quotation.notes}".strip()
        )

        for q_item in quotation.items.all():
            PurchaseOrderItem.objects.create(
                purchase_order=pr,
                product=q_item.product,
                quantity=q_item.requested_quantity,
                unit_price=q_item.offered_unit_price,
                total_cost=q_item.line_total,
                notes=f"Quoted available: {q_item.available_quantity}"
            )

        quotation.purchase_order = pr
        quotation.status = SupplierQuotation.Status.SELECTED
        quotation.save()

        notify_admins(
            f"New PO Awaiting Approval: {pr.request_number}",
            f"Store Manager generated PO {pr.request_number} from Quotation #{quotation.quotation_number} (ETB {pr.total_estimated_cost}). Ready for Admin review.",
            link="/admin/procurement/approvals"
        )
        AuditLog.objects.create(user=request.user, action="PO_CREATED_FROM_QUOTATION", details=f"Created PO {pr.request_number} from Quotation #{quotation.quotation_number}")
        return Response({'message': f"Purchase Order {pr.request_number} created successfully.", 'purchase_order': PurchaseRequestSerializer(pr).data}, status=status.HTTP_201_CREATED)

