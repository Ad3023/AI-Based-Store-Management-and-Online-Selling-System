from decimal import Decimal
from rest_framework import generics, status
from rest_framework.response import Response
from accounts.models import User, AuditLog
from accounts.permissions import require_permission
from .models import Product, Supplier, PurchaseRequest, PurchaseOrderItem
from .serializers import PurchaseRequestSerializer


def is_admin_user(user):
    return bool(
        user.is_superuser or
        getattr(user, 'is_super_admin', False) or
        getattr(user, 'role', '') in [User.RoleChoices.ADMIN, User.RoleChoices.SUPER_ADMIN] or
        user.username == 'addisuguche_admin'
    )


class PurchaseRequestListCreateView(generics.ListCreateAPIView):
    """Lists store-scoped purchase orders and creates new purchase orders."""
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
        else:
            req_by = self.request.query_params.get('requested_by') or self.request.query_params.get('store_id')
            if req_by:
                qs = qs.filter(requested_by_id=req_by)

        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        supplier_id = self.request.query_params.get('supplier_id')
        if supplier_id:
            qs = qs.filter(supplier_id=supplier_id)
        product_filter = self.request.query_params.get('product_id')
        if product_filter:
            qs = qs.filter(product_id=product_filter)
        return qs

    def create(self, request, *args, **kwargs):
        data = request.data
        supplier_id = data.get('supplier')
        if not supplier_id:
            return Response({'error': 'Supplier is required.'}, status=status.HTTP_400_BAD_REQUEST)

        supplier = Supplier.objects.filter(pk=supplier_id).first()
        if not supplier:
            return Response({'error': 'Selected supplier does not exist.'}, status=status.HTTP_400_BAD_REQUEST)

        items_data = data.get('items', [])
        req_status = data.get('status') or PurchaseRequest.Status.DRAFT
        if req_status not in [PurchaseRequest.Status.DRAFT, PurchaseRequest.Status.PENDING_APPROVAL, PurchaseRequest.Status.SUBMITTED]:
            req_status = PurchaseRequest.Status.PENDING_APPROVAL if req_status == PurchaseRequest.Status.APPROVED else PurchaseRequest.Status.DRAFT

        pr = PurchaseRequest.objects.create(
            supplier=supplier, status=req_status,
            expected_supply_date=data.get('expected_supply_date') or None,
            notes=data.get('notes', ''), requested_by=request.user
        )

        total_cost, total_qty, first_prod = Decimal('0.00'), 0, None
        if items_data and isinstance(items_data, list):
            for item in items_data:
                prod = Product.objects.filter(pk=item.get('product') or item.get('product_id')).first()
                if not prod:
                    continue
                qty = int(item.get('quantity') or 1)
                unit_price = Decimal(str(item.get('unit_price') or item.get('agreed_price') or prod.cost_price or '0.00'))
                line_total = unit_price * qty
                total_cost += line_total
                total_qty += qty
                if not first_prod:
                    first_prod = prod
                PurchaseOrderItem.objects.create(
                    purchase_order=pr, product=prod, quantity=qty,
                    unit_price=unit_price, total_cost=line_total, notes=item.get('notes', '')
                )
        else:
            prod = Product.objects.filter(pk=data.get('product')).first() if data.get('product') else None
            if prod:
                first_prod = prod
                qty = int(data.get('quantity') or prod.reorder_quantity or 20)
                unit_price = Decimal(str(data.get('agreed_price') or data.get('estimated_unit_cost') or prod.cost_price or '0.00'))
                line_total = unit_price * qty
                total_cost += line_total
                total_qty += qty
                PurchaseOrderItem.objects.create(
                    purchase_order=pr, product=prod, quantity=qty,
                    unit_price=unit_price, total_cost=line_total, notes=data.get('notes', '')
                )

        pr.product = first_prod
        pr.quantity = total_qty or int(data.get('quantity') or 1)
        pr.total_estimated_cost = total_cost
        if total_qty > 0:
            pr.estimated_unit_cost = (total_cost / total_qty).quantize(Decimal('0.01'))
            pr.agreed_price = pr.estimated_unit_cost
        pr.save()

        AuditLog.objects.create(
            user=request.user, action="PURCHASE_ORDER_CREATED",
            details=f"Created PO {pr.request_number} for {supplier.name} in state [{pr.status}]"
        )
        return Response(self.get_serializer(pr).data, status=status.HTTP_201_CREATED)

