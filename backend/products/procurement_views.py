from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from django.utils import timezone
from accounts.models import AuditLog
from accounts.permissions import require_permission
from .models import PurchaseRequest, PurchaseOrderItem, StockMovement
from .serializers import PurchaseRequestSerializer
from .procurement_base import is_admin_user, PurchaseRequestListCreateView


class PurchaseRequestDetailView(generics.RetrieveUpdateAPIView):
    """Retrieves and updates purchase orders with store ownership validation."""
    serializer_class = PurchaseRequestSerializer

    def get_permissions(self):
        return [require_permission('inventory.manage')()]

    def get_queryset(self):
        user = self.request.user
        qs = PurchaseRequest.objects.all().select_related(
            'product', 'supplier', 'requested_by', 'approved_by'
        ).prefetch_related('items')
        if not is_admin_user(user):
            qs = qs.filter(requested_by=user)
        return qs

    def perform_update(self, serializer):
        new_status = self.request.data.get('status')
        user = self.request.user
        kwargs = {}
        if new_status in [PurchaseRequest.Status.APPROVED, PurchaseRequest.Status.REJECTED]:
            if not is_admin_user(user):
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied('Only platform administrators can approve or reject purchase orders.')
            kwargs['approved_by'] = user
            kwargs['approval_date'] = timezone.now()
            if 'admin_feedback' in self.request.data:
                kwargs['admin_feedback'] = self.request.data.get('admin_feedback', '')
        serializer.save(**kwargs)


class PurchaseRequestSendToSupplierView(APIView):
    """Sends an approved purchase order to the external supplier."""
    def post(self, request, pk):
        pr = PurchaseRequest.objects.filter(pk=pk).first()
        if not pr:
            return Response({'error': 'Purchase order not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not is_admin_user(request.user) and pr.requested_by_id != request.user.id:
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        if pr.status not in [PurchaseRequest.Status.APPROVED, PurchaseRequest.Status.SENT_TO_SUPPLIER]:
            return Response({'error': f'Cannot send order in status {pr.status}. Must be APPROVED.'}, status=status.HTTP_400_BAD_REQUEST)

        pr.status = PurchaseRequest.Status.SENT_TO_SUPPLIER
        notes = request.data.get('supplier_confirmation_notes') or request.data.get('notes')
        if notes:
            pr.supplier_confirmation_notes = notes
        pr.save()
        return Response({'message': f'PO {pr.request_number} marked as sent to supplier.', 'purchase_request': PurchaseRequestSerializer(pr).data})


class PurchaseRequestReceiveStockView(APIView):
    """Records received inventory units from a purchase order into stock."""
    def post(self, request, pk):
        pr = PurchaseRequest.objects.select_related('product', 'supplier').prefetch_related('items').filter(pk=pk).first()
        if not pr:
            return Response({'error': 'Purchase order not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not is_admin_user(request.user) and pr.requested_by_id != request.user.id:
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        if pr.status in [PurchaseRequest.Status.DRAFT, PurchaseRequest.Status.PENDING_APPROVAL, PurchaseRequest.Status.REJECTED, PurchaseRequest.Status.CANCELLED]:
            return Response({'error': f'Cannot receive stock for order in status {pr.status}.'}, status=status.HTTP_400_BAD_REQUEST)

        items_payload = request.data.get('items', [])
        total_recv, total_dam = 0, 0

        if items_payload and isinstance(items_payload, list):
            for it_data in items_payload:
                it_obj = PurchaseOrderItem.objects.filter(pk=it_data.get('id'), purchase_order=pr).first()
                if not it_obj:
                    continue
                rec_qty = int(it_data.get('received_quantity') or it_data.get('received_now') or 0)
                dam_qty = int(it_data.get('damaged_quantity') or 0)
                if rec_qty <= 0 and dam_qty <= 0:
                    continue
                it_obj.received_quantity += rec_qty
                it_obj.damaged_quantity += dam_qty
                it_obj.save()
                if rec_qty > 0:
                    it_obj.product.stock += rec_qty
                    it_obj.product.low_stock_notified = False
                    it_obj.product.save()
                    StockMovement.objects.create(
                        product=it_obj.product, quantity=rec_qty,
                        movement_type=StockMovement.MovementType.RESTOCK,
                        reference=f"PO {pr.request_number} Item Received ({rec_qty} pcs)", created_by=request.user
                    )
                total_recv += rec_qty
                total_dam += dam_qty
            pr.received_quantity += total_recv
            pr.damaged_quantity += total_dam
            total_ordered = sum(i.quantity for i in pr.items.all())
            pr.status = PurchaseRequest.Status.RECEIVED if pr.received_quantity >= total_ordered else PurchaseRequest.Status.PARTIALLY_RECEIVED
            pr.save()
        else:
            rec_qty = int(request.data.get('received_quantity') or max(0, pr.quantity - pr.received_quantity))
            dam_qty = int(request.data.get('damaged_quantity') or 0)
            if rec_qty <= 0 and dam_qty <= 0:
                return Response({'error': 'Received quantity must be greater than zero.'}, status=status.HTTP_400_BAD_REQUEST)
            pr.received_quantity += rec_qty
            pr.damaged_quantity += dam_qty
            pr.status = PurchaseRequest.Status.RECEIVED if pr.received_quantity >= pr.quantity else PurchaseRequest.Status.PARTIALLY_RECEIVED
            pr.save()
            first_item = pr.items.first()
            if first_item:
                first_item.received_quantity += rec_qty
                first_item.damaged_quantity += dam_qty
                first_item.save()
            if pr.product and rec_qty > 0:
                pr.product.stock += rec_qty
                pr.product.low_stock_notified = False
                pr.product.save()
                StockMovement.objects.create(
                    product=pr.product, quantity=rec_qty,
                    movement_type=StockMovement.MovementType.RESTOCK,
                    reference=f"PO {pr.request_number} Received ({rec_qty} pcs)", created_by=request.user
                )
            total_recv, total_dam = rec_qty, dam_qty

        AuditLog.objects.create(
            user=request.user, action="PURCHASE_ORDER_STOCK_RECEIVED",
            details=f"Received {total_recv} units ({total_dam} damaged) for PO {pr.request_number}"
        )
        return Response({
            'success': True,
            'message': f"Recorded {total_recv} units received for PO {pr.request_number}.",
            'purchase_request': PurchaseRequestSerializer(pr).data
        })
