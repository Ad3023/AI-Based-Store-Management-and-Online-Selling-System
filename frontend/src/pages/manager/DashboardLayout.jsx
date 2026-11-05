import React, { useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { getUserRoleLabel, getUserRoleBadgeClass } from '../../utils/orderStatus';
import { getMediaUrl, getDefaultAvatar } from '../../utils/imageUrl';
import DashboardSidebar from './components/DashboardSidebar';
import DashboardHeader from './components/DashboardHeader';

const DashboardLayout = () => {
  const {
    user,
    logout,
    isStoreManager,
    isOrderManager,
    isAdmin,
    isSuperAdmin,
    isSubAdmin,
    hasPermission,
    hasAnyPermission
  } = useAuth();

  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [showBellDropdown, setShowBellDropdown] = useState(false);
  const navigate = useNavigate();

  if (!user || (!isStoreManager && !isAdmin && !isSuperAdmin && !isSubAdmin && !isOrderManager)) {
    return (
      <div className="container py-5 text-center">
        <div className="card border-0 shadow-sm rounded-4 p-5 mx-auto" style={{ maxWidth: '520px' }}>
          <i className="bi bi-shield-x fs-1 text-danger mb-3"></i>
          <h4 className="fw-bold">Access Restricted</h4>
          <p className="text-muted small mb-4">
            This management console is strictly reserved for authenticated administrators and authorized staff.
          </p>
          <div className="d-flex justify-content-center gap-2">
            <Link to="/login" className="btn btn-ethio-primary px-4">Sign In</Link>
            <Link to="/" className="btn btn-outline-secondary px-4">Return Home</Link>
          </div>
        </div>
      </div>
    );
  }

  const handleSignOut = () => {
    logout();
    navigate('/');
  };

  const avatarUrl = user?.avatar
    ? getMediaUrl(user.avatar)
    : getDefaultAvatar(user?.first_name || user?.username);

  const roleLabel = getUserRoleLabel(user);
  const roleBadgeClass = getUserRoleBadgeClass(user);

  // Permission conditions for module visibility
  const canViewCatalog = isSuperAdmin || hasAnyPermission(['products.view', 'products.create', 'products.edit', 'products.delete']);
  const canManageCategories = isSuperAdmin || hasAnyPermission(['categories.manage', 'products.view']);
  const canManageInventory = isSuperAdmin || hasAnyPermission(['inventory.manage', 'products.view']);
  const canManagePromotions = isSuperAdmin || hasPermission('promotions.manage');
  const canViewOrders = isSuperAdmin || hasAnyPermission(['orders.view', 'orders.update']);
  const canViewPayments = isSuperAdmin || hasAnyPermission(['payments.view', 'payments.verify']);
  const canManageWarranty = isSuperAdmin || hasPermission('refunds.manage');
  const canManageFeedback = isSuperAdmin || hasAnyPermission(['products.edit', 'refunds.manage']);
  const canViewCustomers = isSuperAdmin || hasPermission('customers.view');
  const canViewReports = isSuperAdmin || hasPermission('reports.view');
  const canManageUsers = isSuperAdmin || hasPermission('users.manage');
  const canManageRoles = isSuperAdmin || hasPermission('roles.manage');
  const canViewAudits = isSuperAdmin || hasPermission('audit_logs.view');
  const canManageSettings = isSuperAdmin || hasPermission('settings.manage');

  const isActualStoreManager = user?.role === 'store_manager';
  const showGovernance = !isActualStoreManager && (isSuperAdmin || isAdmin || canManageUsers || canManageRoles || canViewAudits || canManageSettings);

  return (
    <div className="ethio-dashboard-layout">
      <DashboardSidebar
        mobileDrawerOpen={mobileDrawerOpen}
        setMobileDrawerOpen={setMobileDrawerOpen}
        user={user}
        avatarUrl={avatarUrl}
        roleLabel={roleLabel}
        roleBadgeClass={roleBadgeClass}
        isAdmin={isAdmin}
        isOrderManager={isOrderManager}
        isSuperAdmin={isSuperAdmin}
        canViewReports={canViewReports}
        canViewCatalog={canViewCatalog}
        canManageCategories={canManageCategories}
        canManageInventory={canManageInventory}
        canManagePromotions={canManagePromotions}
        canViewOrders={canViewOrders}
        canViewPayments={canViewPayments}
        canManageWarranty={canManageWarranty}
        canManageFeedback={canManageFeedback}
        canViewCustomers={canViewCustomers}
        showGovernance={showGovernance}
        canManageUsers={canManageUsers}
        canManageRoles={canManageRoles}
        canViewAudits={canViewAudits}
        canManageSettings={canManageSettings}
        unreadCount={unreadCount}
        hasPermission={hasPermission}
        handleSignOut={handleSignOut}
      />

      <div className="ethio-dashboard-content">
        <main className="p-3 p-md-4 p-lg-5" style={{ minWidth: 0 }}>
          <DashboardHeader
            user={user}
            isAdmin={isAdmin}
            isOrderManager={isOrderManager}
            unreadCount={unreadCount}
            showBellDropdown={showBellDropdown}
            setShowBellDropdown={setShowBellDropdown}
            notifications={notifications}
            markAsRead={markAsRead}
            markAllAsRead={markAllAsRead}
            setMobileDrawerOpen={setMobileDrawerOpen}
          />
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
