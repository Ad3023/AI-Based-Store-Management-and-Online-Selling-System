import React from 'react';

export const POStatusBadge = ({ status }) => {
  switch (status) {
    case 'DRAFT':
      return <span className="badge bg-secondary">Draft</span>;
    case 'PENDING_APPROVAL':
    case 'SUBMITTED':
      return <span className="badge bg-warning text-dark border border-warning">Pending Approval</span>;
    case 'APPROVED':
      return <span className="badge bg-success">Approved</span>;
    case 'SENT_TO_SUPPLIER':
      return <span className="badge bg-info text-dark">Sent to Supplier</span>;
    case 'PARTIALLY_RECEIVED':
      return <span className="badge bg-primary">Partially Received</span>;
    case 'RECEIVED':
      return <span className="badge bg-success">Received / Complete</span>;
    case 'REJECTED':
      return <span className="badge bg-danger">Rejected</span>;
    case 'CANCELLED':
      return <span className="badge bg-dark">Cancelled</span>;
    default:
      return <span className="badge bg-secondary">{status}</span>;
  }
};

export default POStatusBadge;

