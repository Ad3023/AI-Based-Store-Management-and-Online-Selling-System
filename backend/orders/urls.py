from django.urls import path
from .views import (
    CartView, CheckoutView, OrderListView, OrderDetailView,
    PaymentEvidenceUploadView, StoreManagerPaymentVerificationView,
    StoreManagerOrderStatusUpdateView, ReceiptDetailView,
    ChapaInitializePaymentView, ChapaVerifyPaymentView, ChapaWebhookView
)
from .dashboard_views import DashboardAnalyticsView, ExportSalesReportView, ExportInventoryReportView

urlpatterns = [
    path('cart/', CartView.as_view(), name='cart'),
    path('checkout/', CheckoutView.as_view(), name='checkout'),
    path('chapa/initialize/', ChapaInitializePaymentView.as_view(), name='chapa-initialize'),
    path('<int:order_id>/chapa/initialize/', ChapaInitializePaymentView.as_view(), name='chapa-order-initialize'),
    path('chapa/verify/', ChapaVerifyPaymentView.as_view(), name='chapa-verify'),
    path('<int:order_id>/chapa/verify/', ChapaVerifyPaymentView.as_view(), name='chapa-order-verify'),
    path('chapa/webhook/', ChapaWebhookView.as_view(), name='chapa-webhook'),
    path('analytics/dashboard/', DashboardAnalyticsView.as_view(), name='dashboard-analytics'),
    path('analytics/export-sales/', ExportSalesReportView.as_view(), name='export-sales'),
    path('analytics/export-inventory/', ExportInventoryReportView.as_view(), name='export-inventory'),
    path('', OrderListView.as_view(), name='order-list'),
    path('<int:pk>/', OrderDetailView.as_view(), name='order-detail'),
    path('<int:order_id>/payment-evidence/', PaymentEvidenceUploadView.as_view(), name='upload-payment-evidence'),
    path('<int:order_id>/verify-payment/', StoreManagerPaymentVerificationView.as_view(), name='verify-payment'),
    path('<int:order_id>/status/', StoreManagerOrderStatusUpdateView.as_view(), name='update-order-status'),
    path('<int:order_id>/receipt/', ReceiptDetailView.as_view(), name='order-receipt'),
]
