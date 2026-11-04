from django.urls import path
from .supplier_portal_views import (
    SupplierDashboardStatsView,
    SupplierPurchaseOrderListView,
    SupplierPurchaseOrderDetailView,
    SupplierPurchaseOrderRespondView,
    SupplierPurchaseOrderDeliveryUpdateView,
    SupplierPortalInvoiceListCreateView,
    SupplierPortalPaymentListView,
    SupplierPortalNotificationListView,
)

urlpatterns = [
    # Supplier Portal Dashboard & Stats
    path('dashboard/', SupplierDashboardStatsView.as_view(), name='supplier-dashboard-stats'),

    # Purchase Orders & Response
    path('purchase-orders/', SupplierPurchaseOrderListView.as_view(), name='supplier-po-list'),
    path('purchase-orders/<int:pk>/', SupplierPurchaseOrderDetailView.as_view(), name='supplier-po-detail'),
    path('purchase-orders/<int:pk>/respond/', SupplierPurchaseOrderRespondView.as_view(), name='supplier-po-respond'),
    path('purchase-orders/<int:pk>/delivery-update/', SupplierPurchaseOrderDeliveryUpdateView.as_view(), name='supplier-po-delivery-update'),

    # Invoices
    path('invoices/', SupplierPortalInvoiceListCreateView.as_view(), name='supplier-invoice-list-create'),

    # Payments (Read-Only)
    path('payments/', SupplierPortalPaymentListView.as_view(), name='supplier-payment-list'),

    # Notifications
    path('notifications/', SupplierPortalNotificationListView.as_view(), name='supplier-notification-list'),
]

