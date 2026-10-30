/**
 * Utilities for formatting, mapping, and presenting order and user status consistently.
 * Enforces separation between Payment Status and Fulfillment Status.
 */

/**
 * Returns a clean display name for a user without any appended role strings (e.g. "(Admin)").
 * @param {Object} user 
 * @returns {string}
 */
export const cleanDisplayName = (user) => {
  if (!user) return '';
  const fullName = user.first_name
    ? `${user.first_name} ${user.last_name || ''}`.trim()
    : (user.username || '');
  
  // Strip any accidental "(Admin)", "(Customer)", "(Manager)", "(Order Manager)" etc. appended to display names
  return fullName
    .replace(/\s*\((?:Admin|Administrator|Customer|Store Manager|Order Manager|Manager|Staff)\)/gi, '')
    .trim();
};

/**
 * Normalizes and extracts user role from either a user object or a raw string.
 * Strictly maps to application roles: 'admin', 'store_manager', 'order_manager', 'customer'.
 * @param {Object|string} input 
 * @returns {string}
 */
export const extractUserRole = (input) => {
  if (!input) return 'customer';
  if (typeof input === 'string') {
    const s = input.trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (s === 'super_admin' || s === 'superadmin' || s === 'superuser' || s === 'admin' || s === 'administrator' || s === 'sub_admin' || s === 'subadmin') {
      return 'admin';
    }
    if (s === 'order_manager' || s === 'ordermanager') {
      return 'order_manager';
    }
    if (s === 'store_manager' || s === 'manager') {
      return 'store_manager';
    }
    return 'customer';
  }
  if (typeof input === 'object') {
    if (input.role === 'order_manager') {
      return 'order_manager';
    }
    if (input.is_super_admin || input.is_superuser || input.role === 'super_admin' || input.role === 'admin' || input.is_staff) {
      if (input.role === 'store_manager' && !input.is_superuser && !input.is_super_admin) {
        return 'store_manager';
      }
      if (input.role === 'order_manager' && !input.is_superuser && !input.is_super_admin) {
        return 'order_manager';
      }
      return 'admin';
    }
    const roleVal = input.role || input.user_role;
    if (roleVal) {
      const s = String(roleVal).trim().toLowerCase().replace(/[\s-]+/g, '_');
      if (s === 'super_admin' || s === 'superadmin' || s === 'superuser' || s === 'admin' || s === 'administrator' || s === 'sub_admin' || s === 'subadmin') {
        return 'admin';
      }
      if (s === 'order_manager' || s === 'ordermanager') {
        return 'order_manager';
      }
      if (s === 'store_manager' || s === 'manager') {
        return 'store_manager';
      }
      return 'customer';
    }
    if (input.custom_role?.name) {
      const c = input.custom_role.name.toLowerCase();
      if (c.includes('admin')) return 'admin';
      if (c.includes('order')) return 'order_manager';
      if (c.includes('manager')) return 'store_manager';
    }
  }
  return 'customer';
};

/**
 * Returns the authoritative uppercase role label for display badges.
 * Strictly uses 'ADMIN', 'STORE MANAGER', 'ORDER MANAGER', or 'CUSTOMER'.
 * @param {Object|string} user 
 * @returns {string}
 */
export const getUserRoleLabel = (user) => {
  if (!user) return '';
  const role = extractUserRole(user);
  if (role === 'admin') return 'ADMIN';
  if (role === 'store_manager') return 'STORE MANAGER';
  if (role === 'order_manager') return 'ORDER MANAGER';
  if (role === 'customer') return 'CUSTOMER';
  return '';
};

/**
 * Returns role badge styling classes with accessible high-contrast text.
 * @param {Object|string} user 
 * @returns {string}
 */
export const getUserRoleBadgeClass = (user) => {
  if (!user) return 'bg-secondary text-white';
  const role = extractUserRole(user);
  if (role === 'admin') return 'bg-primary text-white border-0 fw-bold shadow-sm';
  if (role === 'store_manager') return 'bg-info text-dark border-0 fw-bold shadow-sm';
  if (role === 'order_manager') return 'bg-amber-500 text-white border-0 fw-bold shadow-sm';
  return 'bg-secondary text-white border-0 fw-bold shadow-sm';
};

/**
 * Evaluates the payment status of an order independently from fulfillment.
 * @param {Object} order 
 * @returns {{ label: string, badgeClass: string, isPaid: boolean, isFailed: boolean, isPending: boolean }}
 */
export const getPaymentStatusInfo = (order) => {
  if (!order) {
    return {
      label: 'Pending',
      badgeClass: 'bg-amber-100 text-amber-800 border border-amber-200',
      isPaid: false,
      isFailed: false,
      isPending: true,
    };
  }

  const rawPay = order.payment_status ? String(order.payment_status).toUpperCase() : null;

  if (rawPay === 'PAID') {
    return {
      label: 'Paid / Verified',
      badgeClass: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
      isPaid: true,
      isFailed: false,
      isPending: false,
    };
  }
  if (rawPay === 'FAILED') {
    return {
      label: 'Payment Failed',
      badgeClass: 'bg-rose-100 text-rose-800 border border-rose-300',
      isPaid: false,
      isFailed: true,
      isPending: false,
    };
  }
  if (rawPay === 'CANCELLED') {
    return {
      label: 'Cancelled',
      badgeClass: 'bg-slate-100 text-slate-700 border border-slate-300',
      isPaid: false,
      isFailed: false,
      isPending: false,
    };
  }
  if (rawPay === 'EXPIRED') {
    return {
      label: 'Expired',
      badgeClass: 'bg-slate-100 text-slate-700 border border-slate-300',
      isPaid: false,
      isFailed: false,
      isPending: false,
    };
  }
  if (rawPay === 'REFUND_PENDING') {
    return {
      label: 'Refund Pending',
      badgeClass: 'bg-purple-100 text-purple-800 border border-purple-300',
      isPaid: false,
      isFailed: false,
      isPending: true,
    };
  }
  if (rawPay === 'PARTIALLY_REFUNDED') {
    return {
      label: 'Partially Refunded',
      badgeClass: 'bg-purple-100 text-purple-800 border border-purple-300',
      isPaid: true,
      isFailed: false,
      isPending: false,
    };
  }
  if (rawPay === 'REFUNDED') {
    return {
      label: 'Refunded',
      badgeClass: 'bg-purple-100 text-purple-800 border border-purple-300',
      isPaid: false,
      isFailed: false,
      isPending: false,
    };
  }

  // Fallback for legacy objects:
  if (order.payment_evidence && order.payment_evidence.verification_status === 'REJECTED') {
    return {
      label: 'Payment Failed',
      badgeClass: 'bg-rose-100 text-rose-800 border border-rose-300',
      isPaid: false,
      isFailed: true,
      isPending: false,
    };
  }

  if (order.status === 'CANCELLED' && !order.receipt && !['PROCESSING', 'SHIPPED', 'DELIVERED'].includes(order.status)) {
    return {
      label: 'Cancelled (Unpaid)',
      badgeClass: 'bg-slate-100 text-slate-700 border border-slate-300',
      isPaid: false,
      isFailed: false,
      isPending: false,
    };
  }

  const isPaid = Boolean(order.receipt) || ['PROCESSING', 'SHIPPED', 'DELIVERED'].includes(order.status);
  if (isPaid) {
    return {
      label: 'Paid / Verified',
      badgeClass: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
      isPaid: true,
      isFailed: false,
      isPending: false,
    };
  }

  return {
    label: 'Pending Verification',
    badgeClass: 'bg-amber-100 text-amber-800 border border-amber-300',
    isPaid: false,
    isFailed: false,
    isPending: true,
  };
};

/**
 * Evaluates the fulfillment / operational status of an order independently from payment.
 * @param {Object} order 
 * @returns {{ label: string, badgeClass: string }}
 */
export const getFulfillmentStatusInfo = (order) => {
  if (!order) return { label: 'Pending', badgeClass: 'bg-slate-100 text-slate-800' };

  const rawFul = order.fulfillment_status
    ? String(order.fulfillment_status).toUpperCase()
    : String(order.status || 'PENDING').toUpperCase();

  switch (rawFul) {
    case 'DELIVERED':
      return {
        label: 'Delivered',
        badgeClass: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
      };
    case 'SHIPPED':
      return {
        label: 'Shipped / In Transit',
        badgeClass: 'bg-cyan-100 text-cyan-800 border border-cyan-300',
      };
    case 'PROCESSING':
      return {
        label: 'Processing',
        badgeClass: 'bg-blue-100 text-blue-800 border border-blue-300',
      };
    case 'CONFIRMED':
      return {
        label: 'Confirmed',
        badgeClass: 'bg-indigo-100 text-indigo-800 border border-indigo-300',
      };
    case 'CANCELLED':
      return {
        label: 'Cancelled',
        badgeClass: 'bg-rose-100 text-rose-800 border border-rose-300',
      };
    case 'REFUNDED':
      return {
        label: 'Refunded',
        badgeClass: 'bg-purple-100 text-purple-800 border border-purple-300',
      };
    case 'PENDING':
    case 'PENDING_PAYMENT':
    default:
      return {
        label: 'Pending Confirmation',
        badgeClass: 'bg-amber-100 text-amber-800 border border-amber-200',
      };
  }
};

/**
 * Builds the accurate tracking milestone sequence based on order status.
 * Handles Cancelled and Failed payment states gracefully without misleading future milestones.
 * @param {Object} order 
 * @returns {Array<{ id: string, title: string, description: string, icon: string, isCompleted: boolean, isCurrent: boolean, isPending: boolean, isCancelled?: boolean, isFailed?: boolean }>}
 */
export const getOrderMilestones = (order) => {
  if (!order) return [];

  // Special Case 1: Cancelled Order
  if (order.status === 'CANCELLED') {
    return [
      {
        id: 'placed',
        title: 'Order Placed',
        description: new Date(order.created_at).toLocaleDateString(),
        icon: 'bi-bag-check-fill',
        isCompleted: true,
        isCurrent: false,
        isPending: false,
      },
      {
        id: 'cancelled',
        title: 'Order Cancelled',
        description: 'Order was cancelled',
        icon: 'bi-x-circle-fill',
        isCompleted: false,
        isCurrent: true,
        isPending: false,
        isCancelled: true,
      },
    ];
  }

  // Special Case 2: Payment Failed / Rejected
  if (order.payment_evidence && order.payment_evidence.verification_status === 'REJECTED') {
    return [
      {
        id: 'placed',
        title: 'Order Placed',
        description: new Date(order.created_at).toLocaleDateString(),
        icon: 'bi-bag-check-fill',
        isCompleted: true,
        isCurrent: false,
        isPending: false,
      },
      {
        id: 'failed',
        title: 'Payment Verification Failed',
        description: order.payment_evidence.rejection_reason || 'Evidence could not be verified',
        icon: 'bi-exclamation-octagon-fill',
        isCompleted: false,
        isCurrent: true,
        isPending: false,
        isFailed: true,
      },
    ];
  }

  // Standard Milestone Progression
  const payStatus = order.payment_status ? String(order.payment_status).toUpperCase() : null;
  const fulStatus = order.fulfillment_status
    ? String(order.fulfillment_status).toUpperCase()
    : String(order.status || '').toUpperCase();

  const isPaid = payStatus === 'PAID' || Boolean(order.receipt) || ['PROCESSING', 'SHIPPED', 'DELIVERED'].includes(fulStatus);
  const isConfirmed = isPaid || ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'].includes(fulStatus);
  const isProcessing = ['PROCESSING', 'SHIPPED', 'DELIVERED'].includes(fulStatus);
  const isShipped = ['SHIPPED', 'DELIVERED'].includes(fulStatus);
  const isDelivered = fulStatus === 'DELIVERED';

  return [
    {
      id: 'placed',
      title: 'Order Placed',
      description: new Date(order.created_at).toLocaleDateString(),
      icon: 'bi-bag-check-fill',
      isCompleted: true,
      isCurrent: !isPaid && fulStatus === 'PENDING',
      isPending: false,
    },
    {
      id: 'payment',
      title: 'Payment Verified',
      description: isPaid
        ? 'Chapa Confirmed'
        : payStatus === 'FAILED'
        ? 'Verification Failed'
        : 'Awaiting Chapa Payment',
      icon: isPaid ? 'bi-patch-check-fill' : 'bi-credit-card-2-front',
      isCompleted: isPaid,
      isCurrent: !isPaid && payStatus === 'PENDING',
      isPending: !isPaid,
    },
    {
      id: 'processing',
      title: 'Processing',
      description: isShipped
        ? 'Inspected & Packed'
        : isProcessing
        ? 'Preparing in Warehouse'
        : isConfirmed
        ? 'Confirmed by Admin'
        : 'Pending Confirmation',
      icon: 'bi-box-seam-fill',
      isCompleted: isShipped,
      isCurrent: isProcessing || (isConfirmed && !isShipped),
      isPending: !isConfirmed,
    },
    {
      id: 'shipped',
      title: 'Dispatched / In Transit',
      description: isDelivered
        ? 'Delivered'
        : isShipped
        ? `En route to ${order.shipping_city || 'destination'}`
        : 'Pending Courier Dispatch',
      icon: 'bi-truck',
      isCompleted: isDelivered,
      isCurrent: isShipped,
      isPending: !isShipped,
    },
    {
      id: 'delivered',
      title: 'Delivered',
      description: isDelivered ? 'Received by Customer' : 'Final Step',
      icon: 'bi-check-circle-fill',
      isCompleted: isDelivered,
      isCurrent: isDelivered,
      isPending: !isDelivered,
    },
  ];
};
