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
  
  // Strip any accidental "(Admin)", "(Customer)", "(Manager)" etc. appended to display names
  return fullName
    .replace(/\s*\((?:Admin|Administrator|Customer|Store Manager|Manager|Staff)\)/gi, '')
    .trim();
};

/**
 * Normalizes and extracts user role from either a user object or a raw string.
 * @param {Object|string} input 
 * @returns {string}
 */
export const extractUserRole = (input) => {
  if (!input) return 'guest';
  if (typeof input === 'string') {
    const s = input.trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (s === 'admin' || s === 'administrator' || s === 'superuser') return 'admin';
    if (s === 'store_manager' || s === 'manager') return 'store_manager';
    if (s === 'customer') return 'customer';
    return s;
  }
  if (typeof input === 'object') {
    if (input.is_superuser) return 'admin';
    const roleVal = input.role || input.user_role || (input.is_staff && input.role !== 'store_manager' ? 'admin' : null);
    if (roleVal) {
      const s = String(roleVal).trim().toLowerCase().replace(/[\s-]+/g, '_');
      if (s === 'admin' || s === 'administrator' || s === 'superuser') return 'admin';
      if (s === 'store_manager' || s === 'manager') return 'store_manager';
      if (s === 'customer') return 'customer';
      return s;
    }
  }
  return 'customer';
};

/**
 * Returns the authoritative uppercase role label for display badges.
 * Accepts either a user object or a raw role string.
 * @param {Object|string} user 
 * @returns {string}
 */
export const getUserRoleLabel = (user) => {
  if (!user) return 'GUEST';
  const role = extractUserRole(user);
  if (role === 'admin') return 'ADMIN';
  if (role === 'store_manager') return 'STORE MANAGER';
  if (role === 'customer') return 'CUSTOMER';
  if (role === 'guest') return 'GUEST';
  return role.toUpperCase().replace(/_/g, ' ');
};

/**
 * Returns role badge styling classes.
 * Accepts either a user object or a raw role string.
 * @param {Object|string} user 
 * @returns {string}
 */
export const getUserRoleBadgeClass = (user) => {
  if (!user) return 'bg-secondary text-white';
  const role = extractUserRole(user);
  if (role === 'admin') return 'bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25';
  if (role === 'store_manager') return 'bg-info bg-opacity-10 text-info border border-info border-opacity-25';
  return 'bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25';
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

  // Check if payment evidence was rejected
  if (order.payment_evidence && order.payment_evidence.verification_status === 'REJECTED') {
    return {
      label: 'Payment Failed',
      badgeClass: 'bg-rose-100 text-rose-800 border border-rose-300',
      isPaid: false,
      isFailed: true,
      isPending: false,
    };
  }

  // If order is cancelled and unpaid
  if (order.status === 'CANCELLED' && !order.receipt && !['PROCESSING', 'SHIPPED', 'DELIVERED'].includes(order.status)) {
    return {
      label: 'Cancelled (Unpaid)',
      badgeClass: 'bg-slate-100 text-slate-700 border border-slate-300',
      isPaid: false,
      isFailed: false,
      isPending: false,
    };
  }

  // Payment is genuinely verified if a receipt exists or status is PROCESSING/SHIPPED/DELIVERED
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

  // Under review
  if (order.status === 'PAYMENT_SUBMITTED' || order.payment_evidence?.verification_status === 'PENDING') {
    return {
      label: 'Under Review',
      badgeClass: 'bg-blue-100 text-blue-800 border border-blue-300',
      isPaid: false,
      isFailed: false,
      isPending: true,
    };
  }

  // Default: Pending payment
  return {
    label: 'Pending Payment',
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

  switch (order.status) {
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
    case 'PAYMENT_SUBMITTED':
      return {
        label: 'Payment Submitted',
        badgeClass: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
      };
    case 'CANCELLED':
      return {
        label: 'Cancelled',
        badgeClass: 'bg-rose-100 text-rose-800 border border-rose-300',
      };
    case 'PENDING_PAYMENT':
    default:
      return {
        label: 'Order Placed',
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
  const isPaid = Boolean(order.receipt) || ['PROCESSING', 'SHIPPED', 'DELIVERED'].includes(order.status);
  const isProcessing = ['PROCESSING', 'SHIPPED', 'DELIVERED'].includes(order.status);
  const isShipped = ['SHIPPED', 'DELIVERED'].includes(order.status);
  const isDelivered = order.status === 'DELIVERED';

  return [
    {
      id: 'placed',
      title: 'Order Placed',
      description: new Date(order.created_at).toLocaleDateString(),
      icon: 'bi-bag-check-fill',
      isCompleted: true,
      isCurrent: order.status === 'PENDING_PAYMENT' && !isPaid,
      isPending: false,
    },
    {
      id: 'payment',
      title: 'Payment Verified',
      description: isPaid
        ? 'Chapa Confirmed'
        : order.status === 'PAYMENT_SUBMITTED'
        ? 'Verification in Review'
        : 'Awaiting Payment',
      icon: isPaid ? 'bi-patch-check-fill' : 'bi-credit-card-2-front',
      isCompleted: isPaid,
      isCurrent: order.status === 'PAYMENT_SUBMITTED',
      isPending: !isPaid && order.status !== 'PAYMENT_SUBMITTED',
    },
    {
      id: 'processing',
      title: 'Processing',
      description: isShipped
        ? 'Items Inspected & Packed'
        : isProcessing
        ? 'Preparing in Warehouse'
        : 'Pending Activation',
      icon: 'bi-box-seam-fill',
      isCompleted: isShipped,
      isCurrent: order.status === 'PROCESSING',
      isPending: !isProcessing,
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
      isCurrent: order.status === 'SHIPPED',
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
