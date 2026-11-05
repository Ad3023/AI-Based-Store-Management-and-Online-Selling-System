import React from 'react';
import { formatETB } from '../../../utils/currency';
import SupplierHistoryTabs from './SupplierHistoryTabs';

const SupplierHistoryModal = ({
  data,
  loading,
  activeTab,
  setActiveTab,
  onClose,
  isAdmin,
  onCreatePO,
}) => {
  if (!data && !loading) return null;

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content border-0 shadow-2xl rounded-4">
          <div className="modal-header bg-slate-900 text-white border-bottom border-slate-800 pb-3">
            <div className="d-flex align-items-center gap-2">
              <div className="rounded-3 p-2 bg-primary bg-opacity-25 text-white">
                <i className="bi bi-truck fs-5"></i>
              </div>
              <div>
                <h5 className="modal-title fw-bold mb-0 text-white text-sm">
                  {data?.supplier?.name || 'Loading Supplier History...'}
                </h5>
                <small className="text-slate-400 text-xs">
                  Comprehensive procurement, PO, invoice, and disbursement records
                </small>
              </div>
            </div>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>

          <div className="modal-body p-4 bg-slate-50">
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status"></div>
                <p className="text-muted text-xs mt-2">Loading supplier ledger...</p>
              </div>
            ) : (
              <>
                <div className="row g-3 mb-4">
                  <div className="col-6 col-md-3">
                    <div className="card border-0 shadow-sm rounded-3 p-3 bg-white text-center">
                      <span className="text-muted text-[11px] fw-bold uppercase">Total Orders</span>
                      <h4 className="fw-bolder text-slate-900 mb-0 mt-1">
                        {data?.metrics?.total_purchase_orders || 0}
                      </h4>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="card border-0 shadow-sm rounded-3 p-3 bg-white text-center">
                      <span className="text-muted text-[11px] fw-bold uppercase">Total Purchases</span>
                      <h4 className="fw-bolder text-primary mb-0 mt-1">
                        {formatETB(data?.metrics?.total_purchased_amount || 0)}
                      </h4>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="card border-0 shadow-sm rounded-3 p-3 bg-white text-center">
                      <span className="text-muted text-[11px] fw-bold uppercase">Total Paid</span>
                      <h4 className="fw-bolder text-success mb-0 mt-1">
                        {formatETB(data?.metrics?.total_paid_amount || 0)}
                      </h4>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="card border-0 shadow-sm rounded-3 p-3 bg-white text-center">
                      <span className="text-muted text-[11px] fw-bold uppercase">Outstanding Balance</span>
                      <h4 className="fw-bolder text-danger mb-0 mt-1">
                        {formatETB(data?.metrics?.outstanding_balance || 0)}
                      </h4>
                    </div>
                  </div>
                </div>

                <div className="card border-0 shadow-sm rounded-3 p-3 mb-4 bg-white text-xs">
                  <div className="row g-2">
                    <div className="col-md-3">
                      <span className="text-muted d-block">Contact Person:</span>
                      <strong className="text-slate-800">{data?.supplier?.contact_person || 'N/A'}</strong>
                    </div>
                    <div className="col-md-3">
                      <span className="text-muted d-block">Email:</span>
                      <strong className="text-slate-800">{data?.supplier?.email || 'N/A'}</strong>
                    </div>
                    <div className="col-md-3">
                      <span className="text-muted d-block">Phone:</span>
                      <strong className="text-slate-800">{data?.supplier?.phone || 'N/A'}</strong>
                    </div>
                    <div className="col-md-3">
                      <span className="text-muted d-block">Address:</span>
                      <strong className="text-slate-800">{data?.supplier?.address || 'N/A'}</strong>
                    </div>
                  </div>
                </div>

                <ul className="nav nav-pills mb-3 gap-2 border-bottom pb-2">
                  <li className="nav-item">
                    <button
                      type="button"
                      className={`btn btn-sm rounded-pill px-3 text-xs ${activeTab === 'products' ? 'btn-primary' : 'btn-outline-secondary'}`}
                      onClick={() => setActiveTab('products')}
                    >
                      <i className="bi bi-box-seam me-1"></i> Supplied Products ({data?.products?.length || 0})
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      type="button"
                      className={`btn btn-sm rounded-pill px-3 text-xs ${activeTab === 'pos' ? 'btn-primary' : 'btn-outline-secondary'}`}
                      onClick={() => setActiveTab('pos')}
                    >
                      <i className="bi bi-cart-check me-1"></i> Purchase Orders ({data?.purchase_orders?.length || 0})
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      type="button"
                      className={`btn btn-sm rounded-pill px-3 text-xs ${activeTab === 'invoices' ? 'btn-primary' : 'btn-outline-secondary'}`}
                      onClick={() => setActiveTab('invoices')}
                    >
                      <i className="bi bi-receipt me-1"></i> Invoices ({data?.invoices?.length || 0})
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      type="button"
                      className={`btn btn-sm rounded-pill px-3 text-xs ${activeTab === 'payments' ? 'btn-primary' : 'btn-outline-secondary'}`}
                      onClick={() => setActiveTab('payments')}
                    >
                      <i className="bi bi-cash-stack me-1"></i> Disbursements ({data?.payments?.length || 0})
                    </button>
                  </li>
                </ul>

                <SupplierHistoryTabs activeTab={activeTab} data={data} />
              </>
            )}
          </div>

          <div className="modal-footer border-top bg-white p-3">
            {!isAdmin && (
              <button
                type="button"
                className="btn btn-sm btn-outline-primary rounded-pill px-3"
                onClick={onCreatePO}
              >
                <i className="bi bi-cart-plus me-1"></i> Create Purchase Order for This Supplier
              </button>
            )}
            <button
              type="button"
              className="btn btn-sm btn-secondary rounded-pill px-4"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupplierHistoryModal;

