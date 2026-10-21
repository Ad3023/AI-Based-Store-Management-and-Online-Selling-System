import React from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { NotificationProvider } from './context/NotificationContext';

// Shared Components
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import RoleDemoSwitcher from './components/RoleDemoSwitcher';

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
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import AIRecommendationsPage from './pages/AIRecommendationsPage';
import TrackOrderPage from './pages/TrackOrderPage';

// Manager & Admin Portal
import DashboardLayout from './pages/manager/DashboardLayout';
import ManagerOverviewPage from './pages/manager/ManagerOverviewPage';
import ManagerOrdersPage from './pages/manager/ManagerOrdersPage';
import ManagerInventoryPage from './pages/manager/ManagerInventoryPage';
import ManagerSegmentationPage from './pages/manager/ManagerSegmentationPage';
import ManagerReportsPage from './pages/manager/ManagerReportsPage';
import AdminUsersPage from './pages/manager/AdminUsersPage';

// Layout with Navbar and Footer for public & customer pages
const CustomerStoreLayout = () => {
  return (
    <div className="d-flex flex-column min-vh-100">
      <Navbar />
      <div className="flex-grow-1">
        <Outlet />
      </div>
      <Footer />
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <WishlistProvider>
          <NotificationProvider>
            <Router>
              <Routes>
                {/* Storefront Layout */}
                <Route element={<CustomerStoreLayout />}>
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
                  <Route path="/checkout" element={<CheckoutPage />} />
                  <Route path="/checkout/payment-verify" element={<PaymentVerifyPage />} />
                  <Route path="/orders" element={<OrdersHistoryPage />} />
                  <Route path="/orders/:id" element={<OrderDetailPage />} />
                  <Route path="/receipts/:id" element={<ReceiptPage />} />
                  <Route path="/orders/:id/receipt" element={<ReceiptPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/recommendations" element={<AIRecommendationsPage />} />
                  <Route path="/track" element={<TrackOrderPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                </Route>

                {/* Store Manager & Administrator Layout */}
                <Route path="/manager" element={<DashboardLayout />}>
                  <Route index element={<ManagerOverviewPage />} />
                  <Route path="orders" element={<ManagerOrdersPage />} />
                  <Route path="inventory" element={<ManagerInventoryPage />} />
                  <Route path="segmentation" element={<ManagerSegmentationPage />} />
                  <Route path="reports" element={<ManagerReportsPage />} />
                  <Route path="admin/users" element={<AdminUsersPage />} />
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

              {/* Quick Demo Role Switcher (Available everywhere for grading demonstration) */}
              <RoleDemoSwitcher />
            </Router>
          </NotificationProvider>
        </WishlistProvider>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
