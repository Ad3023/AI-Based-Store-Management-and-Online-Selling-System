/**
 * EthioTech Market - Centralized Icon System
 * Standardized Bootstrap Icons across all public and internal management interfaces.
 */

export const ICONS = {
  // Common CRUD Actions
  add: 'bi bi-plus-lg',
  addCircle: 'bi bi-plus-circle',
  edit: 'bi bi-pencil-square',
  delete: 'bi bi-trash3',
  search: 'bi bi-search',
  filter: 'bi bi-funnel',
  view: 'bi bi-eye',
  download: 'bi bi-download',
  refresh: 'bi bi-arrow-clockwise',
  save: 'bi bi-check-lg',
  cancel: 'bi bi-x-lg',
  submit: 'bi bi-send',
  back: 'bi bi-arrow-left',
  forward: 'bi bi-arrow-right',
  external: 'bi bi-box-arrow-up-right',
  copy: 'bi bi-clipboard',
  check: 'bi bi-check2',
  info: 'bi bi-info-circle',
  warning: 'bi bi-exclamation-triangle',
  help: 'bi bi-question-circle',

  // Domain Entities
  dashboard: 'bi bi-speedometer2',
  overview: 'bi bi-grid-1x2',
  product: 'bi bi-box-seam',
  category: 'bi bi-diagram-3',
  inventory: 'bi bi-boxes',
  supplier: 'bi bi-truck',
  order: 'bi bi-receipt',
  customer: 'bi bi-people',
  user: 'bi bi-person',
  admin: 'bi bi-shield-shaded',
  role: 'bi bi-shield-lock',
  payment: 'bi bi-credit-card',
  disbursement: 'bi bi-cash-stack',
  shipment: 'bi bi-truck-front-fill',
  delivery: 'bi bi-geo-alt',
  report: 'bi bi-graph-up-arrow',
  promotion: 'bi bi-tag',
  feedback: 'bi bi-chat-left-text',
  review: 'bi bi-star-fill',
  warranty: 'bi bi-shield-check',
  notification: 'bi bi-bell',
  settings: 'bi bi-gear',
  audit: 'bi bi-clock-history',
  cart: 'bi bi-cart3',
  wishlist: 'bi bi-heart',
  compare: 'bi bi-arrow-left-right',
  invoice: 'bi bi-file-earmark-spreadsheet',
  purchaseOrder: 'bi bi-file-earmark-text',
  receive: 'bi bi-box-arrow-in-down',

  // Status Icons
  status: {
    pending: 'bi bi-clock-history',
    approved: 'bi bi-check-circle-fill',
    completed: 'bi bi-check-circle-fill',
    active: 'bi bi-check-circle-fill',
    rejected: 'bi bi-x-circle-fill',
    failed: 'bi bi-x-circle-fill',
    inactive: 'bi bi-slash-circle',
    cancelled: 'bi bi-dash-circle',
    processing: 'bi bi-arrow-repeat',
    shipping: 'bi bi-truck',
    delivered: 'bi bi-box2-heart',
    partial: 'bi bi-pie-chart',
    draft: 'bi bi-pencil',
  }
};

/**
 * Returns standardized badge classes and icon for common entity statuses
 */
export const getStatusBadgeConfig = (statusStr) => {
  if (!statusStr) return { bg: 'bg-secondary', text: 'text-white', icon: ICONS.status.pending, label: 'Unknown' };

  const s = String(statusStr).toUpperCase();

  switch (s) {
    case 'ACTIVE':
    case 'APPROVED':
    case 'DELIVERED':
    case 'COMPLETED':
    case 'RECEIVED':
    case 'PAID':
    case 'VERIFIED':
      return {
        badgeClass: 'badge bg-success bg-opacity-10 text-success border border-success border-opacity-25',
        icon: ICONS.status.approved,
        label: s.replace(/_/g, ' ')
      };

    case 'PENDING':
    case 'PENDING_APPROVAL':
    case 'SUBMITTED':
    case 'PROCESSING':
    case 'IN_TRANSIT':
    case 'SHIPPED':
    case 'PARTIALLY_RECEIVED':
    case 'PARTIALLY_PAID':
    case 'UNDER_REVIEW':
      return {
        badgeClass: 'badge bg-warning bg-opacity-10 text-warning-emphasis border border-warning border-opacity-25',
        icon: ICONS.status.pending,
        label: s.replace(/_/g, ' ')
      };

    case 'REJECTED':
    case 'FAILED':
    case 'CANCELLED':
    case 'INACTIVE':
    case 'OVERDUE':
      return {
        badgeClass: 'badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25',
        icon: ICONS.status.rejected,
        label: s.replace(/_/g, ' ')
      };

    case 'DRAFT':
      return {
        badgeClass: 'badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25',
        icon: ICONS.status.draft,
        label: 'Draft'
      };

    default:
      return {
        badgeClass: 'badge bg-slate-100 text-slate-700 border border-slate-300',
        icon: ICONS.info,
        label: s.replace(/_/g, ' ')
      };
  }
};

export default ICONS;

