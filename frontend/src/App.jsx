import React from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { NotificationProvider } from './context/NotificationContext';
import { CompareProvider } from './context/CompareContext';
import { LanguageProvider } from './context/LanguageContext';

// Route Guards
import { ProtectedRoute, ManagerRoute, AdminRoute, PermissionRoute, OrderManagerRoute, StoreManagerRoute, SupplierRoute } from './components/ProtectedRoute';

// Shared Components
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import FloatingCompareBar from './components/FloatingCompareBar';
import AIShoppingAssistant from './components/AIShoppingAssistant';

// Customer & Public Pages
import HomePage from './pages/HomePage';
import ShopPage from './pages/ShopPage';
import ProductDetailPage from './pages/ProductDetailPage';
import CartPage from './pages/CartPage';
import WishlistPage from './pages/WishlistPage';
import CategoriesPage from './pages/CategoriesPage';
import DealsPage from './pages/DealsPage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import FAQPage from './pages/FAQPage';
import ShippingPage from './pages/ShippingPage';
import ReturnsPage from './pages/ReturnsPage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import CheckoutPage from './pages/CheckoutPage';
import PaymentVerifyPage from './pages/PaymentVerifyPage';
import OrderDetailPage from './pages/OrderDetailPage';
import OrdersHistoryPage from './pages/OrdersHistoryPage';
import ReceiptPage from './pages/ReceiptPage';
import ProfilePage from './pages/ProfilePage';
import CustomerDashboardPage from './pages/CustomerDashboardPage';
import CustomerLoginPage from './pages/CustomerLoginPage';
import StaffLoginPage from './pages/StaffLoginPage';
import RegisterPage from './pages/RegisterPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import UnsubscribePage from './pages/UnsubscribePage';
import AIRecommendationsPage from './pages/AIRecommendationsPage';
import TrackOrderPage from './pages/TrackOrderPage';
import ComparePage from './pages/ComparePage';

// Manager & Admin Portal
import DashboardLayout from './pages/manager/DashboardLayout';
import AdminDashboardPage from './pages/manager/AdminDashboardPage';
import StoreManagerDashboardPage from './pages/manager/StoreManagerDashboardPage';
import ManagerSuppliersPage from './pages/manager/ManagerSuppliersPage';
import ManagerOrdersPage from './pages/manager/ManagerOrdersPage';
import ManagerInventoryPage from './pages/manager/ManagerInventoryPage';
import ManagerSegmentationPage from './pages/manager/ManagerSegmentationPage';
import ManagerReportsPage from './pages/manager/ManagerReportsPage';
import AdminUsersPage from './pages/manager/AdminUsersPage';
import ManagerPromotionsPage from './pages/manager/ManagerPromotionsPage';
import ManagerWarrantyPage from './pages/manager/ManagerWarrantyPage';
import ManagerFeedbackPage from './pages/manager/ManagerFeedbackPage';
import ManagerPaymentsPage from './pages/manager/ManagerPaymentsPage';
import ManagerCategoriesPage from './pages/manager/ManagerCategoriesPage';
import OrderManagerDashboardPage from './pages/manager/OrderManagerDashboardPage';
import AdminDeliveryHubPage from './pages/manager/AdminDeliveryHubPage';
import OrderManagerShipmentsPage from './pages/manager/OrderManagerShipmentsPage';

// Supplier Procurement & Payments
import ProcurementSuppliersPage from './pages/procurement/ProcurementSuppliersPage';
import CreatePurchaseOrderPage from './pages/procurement/CreatePurchaseOrderPage';
import PurchaseOrderHistoryPage from './pages/procurement/PurchaseOrderHistoryPage';
import ReceiveProductsPage from './pages/procurement/ReceiveProductsPage';
import SupplierInvoicesPage from './pages/procurement/SupplierInvoicesPage';
import SupplierPaymentsPage from './pages/procurement/SupplierPaymentsPage';
import ProcurementReportsPage from './pages/procurement/ProcurementReportsPage';
import ProcurementHistoryPage from './pages/procurement/ProcurementHistoryPage';

// External Supplier Portal Pages
import SupplierLoginPage from './pages/supplier/SupplierLoginPage';
import SupplierLayout from './pages/supplier/SupplierLayout';
import SupplierDashboardPage from './pages/supplier/SupplierDashboardPage';
import SupplierPurchaseOrdersPage from './pages/supplier/SupplierPurchaseOrdersPage';
import SupplierPortalInvoicesPage from './pages/supplier/SupplierInvoicesPage';
import SupplierPortalPaymentsPage from './pages/supplier/SupplierPaymentsPage';

// Layout with Navbar and Footer for public & customer pages
const CustomerStoreLayout = () => {
  return (
    <div className="d-flex flex-column min-vh-100" style={{ backgroundColor: '#f4f6fa', width: '100%' }}>
      <Navbar />
      <main className="flex-grow-1" style={{ backgroundColor: '#f4f6fa', width: '100%' }}>
        <Outlet />
      </main>
      <FloatingCompareBar />
      <AIShoppingAssistant />
      <Footer />
    </div>
  );
};

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <CartProvider>
          <WishlistProvider>
            <NotificationProvider>
              <CompareProvider>
                <Router>
                <Routes>
                {/* Storefront Layout */}
                <Route element={<CustomerStoreLayout />}>
                  {/* Public Browsing Routes */}
                  <Route path="/" element={<HomePage />} />
                  <Route path="/shop" element={<ShopPage />} />
                  <Route path="/categories" element={<CategoriesPage />} />
                  <Route path="/deals" element={<DealsPage />} />
                  <Route path="/product/:id" element={<ProductDetailPage />} />
                  <Route path="/cart" element={<CartPage />} />
                  <Route path="/wishlist" element={<WishlistPage />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/contact" element={<ContactPage />} />
                  <Route path="/faq" element={<FAQPage />} />
                  <Route path="/shipping" element={<ShippingPage />} />
                  <Route path="/returns" element={<ReturnsPage />} />
                  <Route path="/privacy" element={<PrivacyPage />} />
                  <Route path="/terms" element={<TermsPage />} />
                  <Route path="/track" element={<TrackOrderPage />} />
                  <Route path="/recommendations" element={<AIRecommendationsPage />} />
                  <Route path="/compare" element={<ComparePage />} />

                  {/* Authentication & Verification Routes */}
                  <Route path="/login" element={<CustomerLoginPage />} />
                  <Route path="/customer/login" element={<CustomerLoginPage />} />
                  <Route path="/staff/login" element={<StaffLoginPage />} />
                  <Route path="/supplier/login" element={<SupplierLoginPage />} />
                  <Route path="/staff-login" element={<StaffLoginPage />} />
                  <Route path="/manager/login" element={<Navigate to="/staff/login" replace />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/verify-email" element={<VerifyEmailPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                  <Route path="/newsletter/unsubscribe" element={<UnsubscribePage />} />
                  <Route path="/newsletter/verify" element={<UnsubscribePage />} />

                  {/* Protected Customer Routes */}
                  <Route
                    path="/checkout"
                    element={
                      <ProtectedRoute>
                        <CheckoutPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/checkout/payment-verify"
                    element={
                      <ProtectedRoute>
                        <PaymentVerifyPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/orders"
                    element={
                      <ProtectedRoute>
                        <OrdersHistoryPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/orders/:id"
                    element={
                      <ProtectedRoute>
                        <OrderDetailPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/receipts/:id"
                    element={
                      <ProtectedRoute>
                        <ReceiptPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/orders/:id/receipt"
                    element={
                      <ProtectedRoute>
                        <ReceiptPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/profile"
                    element={
                      <ProtectedRoute>
                        <ProfilePage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/customer/dashboard"
                    element={
                      <ProtectedRoute>
                        <CustomerDashboardPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/customer"
                    element={
                      <ProtectedRoute>
                        <CustomerDashboardPage />
                      </ProtectedRoute>
                    }
                  />
                </Route>

                {/* Store Manager Protected Layout (/store-manager and /manager) */}
                <Route
                  path="/store-manager"
                  element={
                    <StoreManagerRoute>
                      <DashboardLayout />
                    </StoreManagerRoute>
                  }
                >
                  <Route index element={<StoreManagerDashboardPage />} />
                  <Route path="dashboard" element={<StoreManagerDashboardPage />} />
                  <Route path="products" element={<PermissionRoute permissions={['products.view', 'products.create', 'products.edit', 'products.delete']}><ManagerInventoryPage /></PermissionRoute>} />
                  <Route path="categories" element={<PermissionRoute permissions={['categories.manage', 'products.view']}><ManagerCategoriesPage /></PermissionRoute>} />
                  <Route path="inventory" element={<PermissionRoute permissions={['inventory.manage', 'products.view']}><ManagerInventoryPage /></PermissionRoute>} />
                  <Route path="suppliers" element={<ProcurementSuppliersPage />} />
                  <Route path="procurement/suppliers" element={<ProcurementSuppliersPage />} />
                  <Route path="procurement/purchase-orders/create" element={<CreatePurchaseOrderPage />} />
                  <Route path="procurement/purchase-orders" element={<PurchaseOrderHistoryPage />} />
                  <Route path="procurement/receive" element={<ReceiveProductsPage />} />
                  <Route path="procurement/invoices" element={<SupplierInvoicesPage />} />
                  <Route path="procurement/history" element={<ProcurementHistoryPage />} />
                  <Route path="promotions" element={<PermissionRoute permission="promotions.manage"><ManagerPromotionsPage /></PermissionRoute>} />
                  <Route path="feedback" element={<PermissionRoute permissions={['products.edit', 'refunds.manage']}><ManagerFeedbackPage /></PermissionRoute>} />
                  <Route path="warranty" element={<PermissionRoute permission="refunds.manage"><ManagerWarrantyPage /></PermissionRoute>} />
                  <Route path="segmentation" element={<PermissionRoute permission="customers.view"><ManagerSegmentationPage /></PermissionRoute>} />
                  <Route path="reports" element={<PermissionRoute permission="reports.view"><ManagerReportsPage /></PermissionRoute>} />
                </Route>

                <Route
                  path="/manager"
                  element={
                    <StoreManagerRoute>
                      <DashboardLayout />
                    </StoreManagerRoute>
                  }
                >
                  <Route index element={<StoreManagerDashboardPage />} />
                  <Route path="dashboard" element={<StoreManagerDashboardPage />} />
                  <Route path="products" element={<PermissionRoute permissions={['products.view', 'products.create', 'products.edit', 'products.delete']}><ManagerInventoryPage /></PermissionRoute>} />
                  <Route path="categories" element={<PermissionRoute permissions={['categories.manage', 'products.view']}><ManagerCategoriesPage /></PermissionRoute>} />
                  <Route path="inventory" element={<PermissionRoute permissions={['inventory.manage', 'products.view']}><ManagerInventoryPage /></PermissionRoute>} />
                  <Route path="suppliers" element={<ProcurementSuppliersPage />} />
                  <Route path="procurement/suppliers" element={<ProcurementSuppliersPage />} />
                  <Route path="procurement/purchase-orders/create" element={<CreatePurchaseOrderPage />} />
                  <Route path="procurement/purchase-orders" element={<PurchaseOrderHistoryPage />} />
                  <Route path="procurement/receive" element={<ReceiveProductsPage />} />
                  <Route path="procurement/invoices" element={<SupplierInvoicesPage />} />
                  <Route path="procurement/history" element={<ProcurementHistoryPage />} />
                  <Route path="promotions" element={<PermissionRoute permission="promotions.manage"><ManagerPromotionsPage /></PermissionRoute>} />
                  <Route path="orders" element={<PermissionRoute permissions={['orders.view', 'orders.update']}><ManagerOrdersPage /></PermissionRoute>} />
                  <Route path="payments" element={<PermissionRoute permissions={['payments.view', 'payments.verify']}><ManagerPaymentsPage /></PermissionRoute>} />
                  <Route path="feedback" element={<PermissionRoute permissions={['products.edit', 'refunds.manage']}><ManagerFeedbackPage /></PermissionRoute>} />
                  <Route path="warranty" element={<PermissionRoute permission="refunds.manage"><ManagerWarrantyPage /></PermissionRoute>} />
                  <Route path="segmentation" element={<PermissionRoute permission="customers.view"><ManagerSegmentationPage /></PermissionRoute>} />
                  <Route path="reports" element={<PermissionRoute permission="reports.view"><ManagerReportsPage /></PermissionRoute>} />
                </Route>

                {/* Dedicated Order Manager Protected Layout */}
                <Route
                  path="/order-manager"
                  element={
                    <OrderManagerRoute>
                      <DashboardLayout />
                    </OrderManagerRoute>
                  }
                >
                  <Route index element={<OrderManagerDashboardPage />} />
                  <Route path="dashboard" element={<OrderManagerDashboardPage />} />
                  <Route path="orders" element={<ManagerOrdersPage />} />
                  <Route path="shipments" element={<OrderManagerShipmentsPage />} />
                  <Route path="reports" element={<ManagerReportsPage />} />
                </Route>

                {/* Dedicated Administrator Protected Layout */}
                <Route
                  path="/admin"
                  element={
                    <AdminRoute>
                      <DashboardLayout />
                    </AdminRoute>
                  }
                >
                  <Route index element={<AdminDashboardPage />} />
                  <Route path="dashboard" element={<AdminDashboardPage />} />
                  <Route path="delivery" element={<AdminDeliveryHubPage />} />
                  <Route path="users" element={<AdminUsersPage />} />
                  <Route path="suppliers" element={<ProcurementSuppliersPage />} />
                  <Route path="procurement/approvals" element={<PurchaseOrderHistoryPage adminApprovalMode={true} />} />
                  <Route path="procurement/invoices" element={<SupplierInvoicesPage />} />
                  <Route path="procurement/payments" element={<SupplierPaymentsPage defaultTab="disbursements" />} />
                  <Route path="procurement/payment-history" element={<SupplierPaymentsPage defaultTab="history" />} />
                  <Route path="procurement/reports" element={<ProcurementReportsPage />} />
                  <Route path="products" element={<ManagerInventoryPage />} />
                  <Route path="categories" element={<ManagerCategoriesPage />} />
                  <Route path="inventory" element={<ManagerInventoryPage />} />
                  <Route path="orders" element={<ManagerOrdersPage />} />
                  <Route path="payments" element={<ManagerPaymentsPage />} />
                  <Route path="promotions" element={<ManagerPromotionsPage />} />
                  <Route path="feedback" element={<ManagerFeedbackPage />} />
                  <Route path="warranty" element={<ManagerWarrantyPage />} />
                  <Route path="segmentation" element={<ManagerSegmentationPage />} />
                  <Route path="reports" element={<ManagerReportsPage />} />
                </Route>

                {/* Dedicated External Supplier Protected Layout */}
                <Route
                  path="/supplier"
                  element={
                    <SupplierRoute>
                      <SupplierLayout />
                    </SupplierRoute>
                  }
                >
                  <Route index element={<SupplierDashboardPage />} />
                  <Route path="dashboard" element={<SupplierDashboardPage />} />
                  <Route path="purchase-orders" element={<SupplierPurchaseOrdersPage />} />
                  <Route path="invoices" element={<SupplierPortalInvoicesPage />} />
                  <Route path="payments" element={<SupplierPortalPaymentsPage />} />
                </Route>

                {/* Fallback 404 */}
                <Route
                  path="*"
                  element={
                    <div className="container py-5 text-center">
                      <h2 className="fw-bold">404 - Page Not Found</h2>
                      <p className="text-muted">The requested page does not exist.</p>
                    </div>
                  }
                />
              </Routes>
            </Router>
            </CompareProvider>
          </NotificationProvider>
        </WishlistProvider>
      </CartProvider>
    </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
