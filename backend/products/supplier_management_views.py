from decimal import Decimal
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied

from accounts.models import User, AuditLog
from accounts.permissions import require_permission
from .models import Supplier, PurchaseRequest, SupplierInvoice, SupplierPayment, RequestForQuotation, SupplierQuotation
from .serializers import SupplierSerializer, SupplierInvoiceSerializer, SupplierPaymentSerializer


def _is_platform_admin(user):
    if not user or not user.is_authenticated:
        return False
    return bool(
        user.is_superuser or
        getattr(user, 'is_super_admin', False) or
        getattr(user, 'is_admin', lambda: False)() or
        user.role in [User.RoleChoices.ADMIN, User.RoleChoices.SUPER_ADMIN]
    )


class SupplierListCreateView(generics.ListCreateAPIView):
    """
    Store Manager and Admin can list suppliers.
    ONLY platform Administrators can register/create new supplier organizations.
    """
    queryset = Supplier.objects.all().order_by('name')
    serializer_class = SupplierSerializer

    def get_permissions(self):
        return [require_permission('products.view')()]

    def create(self, request, *args, **kwargs):
        if not _is_platform_admin(request.user):
            return Response(
                {'error': 'Permission Denied: Only platform Administrators can create or register supplier organizations.'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        supplier = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            action="SUPPLIER_CREATED",
            details=f"Admin created supplier organization '{supplier.name}' ({supplier.email})."
        )


class SupplierDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Store Manager can view supplier details.
    ONLY platform Administrators can edit, update status, activate, suspend, or delete suppliers.
    Enforces safe deactivation instead of permanent deletion when business history exists.
    """
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer

    def get_permissions(self):
        return [require_permission('products.view')()]

    def update(self, request, *args, **kwargs):
        if not _is_platform_admin(request.user):
            return Response(
                {'error': 'Permission Denied: Only platform Administrators can edit or update supplier organization details.'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().update(request, *args, **kwargs)

    def perform_update(self, serializer):
        instance = serializer.save()
        if instance.status == Supplier.Status.ACTIVE:
            instance.is_active = True
        elif instance.status in [Supplier.Status.SUSPENDED, Supplier.Status.DEACTIVATED]:
            instance.is_active = False
        instance.save(update_fields=['is_active'])

        if instance.user:
            instance.user.is_active = instance.is_active
            instance.user.save(update_fields=['is_active'])

        AuditLog.objects.create(
            user=self.request.user,
            action="SUPPLIER_UPDATED",
            details=f"Admin updated supplier organization '{instance.name}' (Status: {instance.status})."
        )

    def destroy(self, request, *args, **kwargs):
        if not _is_platform_admin(request.user):
            return Response(
                {'error': 'Permission Denied: Only platform Administrators can delete or deactivate supplier accounts.'},
                status=status.HTTP_403_FORBIDDEN
            )
        instance = self.get_object()

        # Check for related business history
        has_pos = instance.purchase_requests.exists()
        has_invoices = instance.invoices.exists()
        has_payments = instance.payments.exists()
        has_quotations = instance.quotations.exists()
        has_rfqs = instance.rfqs.exists()

        if has_pos or has_invoices or has_payments or has_quotations or has_rfqs:
            instance.status = Supplier.Status.DEACTIVATED
            instance.is_active = False
            instance.save(update_fields=['status', 'is_active', 'updated_at'])
            if instance.user:
                instance.user.is_active = False
                instance.user.save(update_fields=['is_active', 'updated_at'])

            AuditLog.objects.create(
                user=request.user,
                action="SUPPLIER_DEACTIVATED",
                details=f"Supplier '{instance.name}' has existing financial/procurement records and was safely deactivated rather than deleted."
            )
            return Response({
                'message': f"Supplier '{instance.name}' has existing procurement and financial history. The organization has been safely archived and deactivated to preserve audit trails.",
                'archived': True,
                'status': 'DEACTIVATED'
            }, status=status.HTTP_200_OK)

        supplier_name = instance.name
        supplier_user = instance.user
        instance.delete()
        if supplier_user:
            supplier_user.delete()

        AuditLog.objects.create(
            user=request.user,
            action="SUPPLIER_DELETED",
            details=f"Supplier '{supplier_name}' had no business history and was permanently removed."
        )
        return Response({
            'message': f"Supplier '{supplier_name}' had no business history and was deleted successfully.",
            'deleted': True
        }, status=status.HTTP_200_OK)


class SupplierHistoryView(APIView):
    """
    Returns full procurement, invoice, payment, and product history for a given supplier.
    Available to Store Manager and Admin.
    """
    def get_permissions(self):
        return [require_permission('products.view')()]

    def get(self, request, pk):
        supplier = get_object_or_404(Supplier, pk=pk)
        from .serializers import PurchaseRequestSerializer
        pos = supplier.purchase_requests.all().select_related('product', 'approved_by').order_by('-created_at')
        invoices = supplier.invoices.all().select_related('purchase_order').order_by('-created_at')
        payments = supplier.payments.all().select_related('purchase_order', 'invoice', 'authorized_by').order_by('-payment_date')

        return Response({
            'supplier': SupplierSerializer(supplier).data,
            'purchase_orders': PurchaseRequestSerializer(pos, many=True).data,
            'invoices': SupplierInvoiceSerializer(invoices, many=True).data,
            'payments': SupplierPaymentSerializer(payments, many=True).data,
            'summary': {
                'total_pos': pos.count(),
                'total_invoices': invoices.count(),
                'total_payments': payments.count(),
                'total_purchases_amount': str(supplier.total_purchases_amount),
                'total_paid_amount': str(supplier.total_paid_amount),
                'outstanding_balance': str(supplier.outstanding_balance)
            }
        })

