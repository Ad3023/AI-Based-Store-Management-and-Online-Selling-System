from django.urls import path
from .supplier_portal_views import AdminCreateSupplierAccountView
from .supplier_invitation_views import AdminInviteSupplierAccountView
from .views import (
    CategoryListCreateView, CategoryDetailView,
    ProductListView, ProductDetailView,
    ProductReviewCreateView, ProductReviewModerationView,
    InventoryManagementView,
    SupplierListCreateView, SupplierDetailView, SupplierHistoryView,
    PromotionListCreateView, PromotionDetailView,
    ActivePromotionAnnouncementView,
    WarrantyPolicyListCreateView, WarrantyPolicyDetailView,
    CustomerFeedbackListCreateView, CustomerFeedbackDetailView,
    LowStockManagementListView, ResendSupplierLowStockAlertView,
    ProductSupplierNotificationLogsView, PurchaseRequestListCreateView,
    PurchaseRequestDetailView, PurchaseRequestReceiveStockView, PurchaseRequestSendToSupplierView,
    ProductReorderSettingsUpdateView, AdminInventoryMonitoringView,
    SupplierInvoiceListCreateView, SupplierInvoiceDetailView, SupplierInvoiceReviewView,
    SupplierInvoiceStoreVerifyView,
    SupplierPaymentListCreateView, SupplierPaymentDetailView,
    ProcurementReportsView
)
from .rfq_views import RFQListCreateView, RFQDetailView, QuotationComparisonView
from .quotation_selection_views import QuotationSelectView, ConvertQuotationToPOView

urlpatterns = [
    path('categories/', CategoryListCreateView.as_view(), name='category-list'),
    path('categories/<int:pk>/', CategoryDetailView.as_view(), name='category-detail'),
    path('items/', ProductListView.as_view(), name='product-list'),
    path('items/<int:pk>/', ProductDetailView.as_view(), name='product-detail'),
    path('items/<int:pk>/reorder-settings/', ProductReorderSettingsUpdateView.as_view(), name='product-reorder-settings'),
    path('items/<int:product_id>/reviews/', ProductReviewCreateView.as_view(), name='product-review-create'),
    path('reviews/<int:review_id>/moderate/', ProductReviewModerationView.as_view(), name='product-review-moderate'),
    path('inventory/', InventoryManagementView.as_view(), name='inventory-management'),
    path('store-manager-stats/', InventoryManagementView.as_view(), name='store-manager-stats'),

    # Suppliers & History
    path('suppliers/', SupplierListCreateView.as_view(), name='supplier-list-create'),
    path('suppliers/<int:pk>/', SupplierDetailView.as_view(), name='supplier-detail'),
    path('suppliers/<int:pk>/history/', SupplierHistoryView.as_view(), name='supplier-history'),
    path('suppliers/<int:pk>/create-account/', AdminInviteSupplierAccountView.as_view(), name='supplier-create-account'),
    path('suppliers/<int:pk>/invite/', AdminInviteSupplierAccountView.as_view(), name='supplier-invite'),

    # Purchase Orders & Approvals
    path('purchase-requests/', PurchaseRequestListCreateView.as_view(), name='purchase-request-list-create'),
    path('purchase-requests/<int:pk>/', PurchaseRequestDetailView.as_view(), name='purchase-request-detail'),
    path('purchase-requests/<int:pk>/send-to-supplier/', PurchaseRequestSendToSupplierView.as_view(), name='purchase-request-send-to-supplier'),
    path('purchase-requests/<int:pk>/receive-stock/', PurchaseRequestReceiveStockView.as_view(), name='purchase-request-receive-stock'),

    # Supplier Invoices
    path('supplier-invoices/', SupplierInvoiceListCreateView.as_view(), name='supplier-invoice-list-create'),
    path('supplier-invoices/<int:pk>/', SupplierInvoiceDetailView.as_view(), name='supplier-invoice-detail'),
    path('supplier-invoices/<int:pk>/store-verify/', SupplierInvoiceStoreVerifyView.as_view(), name='supplier-invoice-store-verify'),
    path('supplier-invoices/<int:pk>/review/', SupplierInvoiceReviewView.as_view(), name='supplier-invoice-review'),

    # Supplier Payments (Admin authorization & recording)
    path('supplier-payments/', SupplierPaymentListCreateView.as_view(), name='supplier-payment-list-create'),
    path('supplier-payments/<int:pk>/', SupplierPaymentDetailView.as_view(), name='supplier-payment-detail'),

    # Request for Quotation (RFQ) & Supplier Quotations
    path('rfqs/', RFQListCreateView.as_view(), name='rfq-list-create'),
    path('rfqs/<int:pk>/', RFQDetailView.as_view(), name='rfq-detail'),
    path('quotations/compare/', QuotationComparisonView.as_view(), name='quotation-compare'),
    path('quotations/<int:pk>/select/', QuotationSelectView.as_view(), name='quotation-select'),
    path('quotations/<int:pk>/create-po/', ConvertQuotationToPOView.as_view(), name='quotation-create-po'),

    # Procurement & Financial Reports (Admin)
    path('procurement/reports/', ProcurementReportsView.as_view(), name='procurement-reports'),

    # Low-Stock Alerts & Supplier Notifications
    path('low-stock/', LowStockManagementListView.as_view(), name='low-stock-list'),
    path('admin/monitoring/', AdminInventoryMonitoringView.as_view(), name='admin-inventory-monitoring'),
    path('items/<int:pk>/resend-supplier-alert/', ResendSupplierLowStockAlertView.as_view(), name='resend-supplier-alert'),
    path('items/<int:pk>/supplier-notifications/', ProductSupplierNotificationLogsView.as_view(), name='product-supplier-notifications'),

    # Promotions
    path('promotions/', PromotionListCreateView.as_view(), name='promotion-list-create'),
    path('promotions/<int:pk>/', PromotionDetailView.as_view(), name='promotion-detail'),
    path('promotions/active/announcement/', ActivePromotionAnnouncementView.as_view(), name='promotion-active-announcement'),

    # Warranty Policies
    path('warranty-policies/', WarrantyPolicyListCreateView.as_view(), name='warranty-policy-list-create'),
    path('warranty-policies/<int:pk>/', WarrantyPolicyDetailView.as_view(), name='warranty-policy-detail'),

    # Customer Feedback & Inquiries
    path('feedback/', CustomerFeedbackListCreateView.as_view(), name='customer-feedback-list-create'),
    path('feedback/<int:pk>/', CustomerFeedbackDetailView.as_view(), name='customer-feedback-detail'),
]
