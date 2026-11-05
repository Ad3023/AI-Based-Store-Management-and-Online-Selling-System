import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import SupplierSidebar from './components/SupplierSidebar';
import SupplierNavbar from './components/SupplierNavbar';
import SupplierChangePasswordModal from './SupplierChangePasswordModal';

const SupplierLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [location.pathname]);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoadingNotifications(true);
      const res = await api.get('supplier/notifications/');
      const list = res.data.results || res.data || [];
      setNotifications(list);
      const unread = list.filter((n) => !n.is_read).length;
      setUnreadCount(unread);
    } catch (err) {
      console.warn('Failed to fetch supplier notifications:', err);
    } finally {
      setLoadingNotifications(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // 1-min poll
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleSignOut = () => {
    logout();
    navigate('/supplier/login');
  };

  const [forceChangePassword, setForceChangePassword] = useState(Boolean(user?.must_change_password));

  useEffect(() => {
    if (user?.must_change_password) {
      setForceChangePassword(true);
    }
  }, [user?.must_change_password]);

  const supplierName = user?.supplier_name || 'Vendor Partner';

  return (
    <div className="ethio-dashboard-layout">
      <SupplierSidebar
        mobileDrawerOpen={mobileDrawerOpen}
        setMobileDrawerOpen={setMobileDrawerOpen}
        supplierName={supplierName}
        user={user}
        handleSignOut={handleSignOut}
      />

      <div className="ethio-dashboard-content">
        <SupplierNavbar
          supplierName={supplierName}
          user={user}
          setMobileDrawerOpen={setMobileDrawerOpen}
          unreadCount={unreadCount}
          showNotificationDropdown={showNotificationDropdown}
          setShowNotificationDropdown={setShowNotificationDropdown}
          loadingNotifications={loadingNotifications}
          notifications={notifications}
          handleSignOut={handleSignOut}
        />

        <main className="p-3 p-lg-4 flex-grow-1">
          <SupplierChangePasswordModal
            show={forceChangePassword}
            onPasswordChanged={() => {
              setForceChangePassword(false);
              if (user) user.must_change_password = false;
            }}
          />
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default SupplierLayout;
