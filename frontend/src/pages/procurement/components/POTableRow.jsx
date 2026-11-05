import React from 'react';
import { Link } from 'react-router-dom';
import { formatETB } from '../../../utils/currency';
import POStatusBadge from './POStatusBadge';

export const POTableRow = ({
  po,
  isAdmin,
  isSuperAdmin,
  onInspect,
  onOpenDecision,
  onSubmitDraft,
  onSendToSupplier
}) => {
  const isPending = po.status === 'PENDING_APPROVAL' || po.status === 'SUBMITTED';
  const isApproved = po.status === 'APPROVED';
  const isSent = po.status === 'SENT_TO_SUPPLIER';
  const isReceivable = isApproved || isSent || po.status === 'PARTIALLY_RECEIVED';

  return (
    <tr>
      <td className="ps-4">
        <div className="fw-bold text-primary cursor-pointer hover:underline" onClick={() => onInspect(po)}>
          {po.request_number}
        </div>
        <small className="text-slate-400 text-[11px] d-block">
          {new Date(po.created_at).toLocaleDateString()} by {po.requested_by_username || 'Staff'}
        </small>
      </td>
      <td>
        <div className="fw-semibold text-slate-900">{po.supplier_name || 'N/A'}</div>
        {po.supplier_phone && <small className="text-slate-400 text-[10px]">{po.supplier_phone}</small>}
      </td>
      <td>
        <div className="text-slate-800">
          {po.items?.length > 1
            ? `${po.items.length} items (${po.quantity} pcs)`
            : `${po.product_name || 'Product'} (${po.quantity} pcs)`}
        </div>
        {po.received_quantity > 0 && (
          <small className="text-success text-[10px] d-block">
            Received: {po.received_quantity} / {po.quantity} pcs
          </small>
        )}
      </td>
      <td className="fw-bolder text-slate-900">{formatETB(po.total_estimated_cost)}</td>
      <td className="text-slate-600">{po.expected_supply_date || '—'}</td>
      <td><POStatusBadge status={po.status} /></td>
      <td>
        {po.admin_feedback ? (
          <span className="text-truncate d-inline-block text-slate-600" style={{ maxWidth: '140px' }} title={po.admin_feedback}>
            {po.admin_feedback}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td className="text-end pe-4">
        <div className="d-flex justify-content-end gap-1">
          {(isAdmin || isSuperAdmin) && isPending && (
            <>
              <button
                type="button"
                className="btn btn-sm btn-success px-2.5 py-1 text-xs rounded-pill"
                title="Approve PO"
                onClick={() => onOpenDecision(po, 'approve')}
              >
                <i className="bi bi-check-lg me-1"></i> Approve
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-danger px-2.5 py-1 text-xs rounded-pill"
                title="Reject PO"
                onClick={() => onOpenDecision(po, 'reject')}
              >
                <i className="bi bi-x-lg me-1"></i> Reject
              </button>
            </>
          )}

          {!isAdmin && po.status === 'DRAFT' && (
            <button
              type="button"
              className="btn btn-sm btn-outline-primary px-2 py-1 text-xs rounded-pill"
              title="Submit Draft"
              onClick={() => onSubmitDraft(po)}
            >
              <i className="bi bi-send me-1"></i> Submit
            </button>
          )}

          {!isAdmin && isApproved && (
            <button
              type="button"
              className="btn btn-sm btn-info text-dark px-2.5 py-1 text-xs rounded-pill"
              title="Dispatch to Supplier"
              onClick={() => onSendToSupplier(po)}
            >
              <i className="bi bi-truck me-1"></i> Send to Supplier
            </button>
          )}

          {!isAdmin && isReceivable && po.received_quantity < po.quantity && (
            <Link
              to={`/manager/procurement/receive?po=${po.id}`}
              className="btn btn-sm btn-outline-success px-2 py-1 text-xs rounded-pill"
              title="Record Receiving"
            >
              <i className="bi bi-box-arrow-in-down me-1"></i> Receive
            </Link>
          )}

          {!isAdmin && isReceivable && (
            <Link
              to={`/manager/procurement/invoices?po=${po.id}&supplier=${po.supplier}`}
              className="btn btn-sm btn-outline-secondary px-2 py-1 text-xs rounded-pill"
              title="Submit Invoice"
            >
              <i className="bi bi-receipt"></i>
            </Link>
          )}

          <button
            type="button"
            className="btn btn-sm btn-outline-secondary px-2 py-1 text-xs rounded-pill"
            title="Inspect Details"
            onClick={() => onInspect(po)}
          >
            <i className="bi bi-eye"></i>
          </button>
        </div>
      </td>
    </tr>
  );
};

export default POTableRow;

