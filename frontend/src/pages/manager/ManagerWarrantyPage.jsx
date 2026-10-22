import React, { useState, useEffect } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { formatETB } from '../../utils/currency';

const ManagerWarrantyPage = () => {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('claims'); // 'claims' or 'policies'
  const [claims, setClaims] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Review Modal state
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [claimStatus, setClaimStatus] = useState('UNDER_REVIEW');
  const [adminNotes, setAdminNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [resolutionDetails, setResolutionDetails] = useState('');
  const [updatingClaim, setUpdatingClaim] = useState(false);

  // New Policy Modal state
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [submittingPolicy, setSubmittingPolicy] = useState(false);
  const [policyForm, setPolicyForm] = useState({
    name: '',
    duration_days: 7,
    coverage_summary: '',
    terms_and_conditions: '',
    claim_instructions: '',
    is_default: false,
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [claimsRes, policiesRes] = await Promise.all([
        api.get('orders/warranty-claims/').catch(() => ({ data: [] })),
        api.get('products/warranty-policies/').catch(() => ({ data: [] })),
      ]);
      setClaims(claimsRes.data.results || claimsRes.data || []);
      setPolicies(policiesRes.data.results || policiesRes.data || []);
    } catch (err) {
      console.error('Error fetching warranty data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenClaimModal = (claim) => {
    setSelectedClaim(claim);
    setClaimStatus(claim.status);
    setAdminNotes(claim.admin_notes || '');
    setRejectionReason(claim.rejection_reason || '');
    setResolutionDetails(claim.resolution_details || '');
  };

  const handleUpdateClaim = async (e) => {
    e.preventDefault();
    if (!selectedClaim) return;
    try {
      setUpdatingClaim(true);
      await api.patch(`orders/warranty-claims/${selectedClaim.id}/`, {
        status: claimStatus,
        admin_notes: adminNotes,
        rejection_reason: claimStatus === 'REJECTED' ? rejectionReason : '',
        resolution_details: ['APPROVED', 'RESOLVED'].includes(claimStatus) ? resolutionDetails : '',
      });
      setSelectedClaim(null);
      setFeedback({ type: 'success', text: `Claim #${selectedClaim.claim_number} updated to ${claimStatus}.` });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update claim status.');
    } finally {
      setUpdatingClaim(false);
    }
  };

  const handleCreatePolicy = async (e) => {
    e.preventDefault();
    if (!policyForm.name || !policyForm.duration_days) {
      alert('Please fill in required policy fields.');
      return;
    }
    try {
      setSubmittingPolicy(true);
      await api.post('products/warranty-policies/', {
        ...policyForm,
        duration_days: Number(policyForm.duration_days),
      });
      setShowPolicyModal(false);
      setFeedback({ type: 'success', text: 'Warranty policy created successfully.' });
      setPolicyForm({
        name: '',
        duration_days: 7,
        coverage_summary: '',
        terms_and_conditions: '',
        claim_instructions: '',
        is_default: false,
      });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create warranty policy.');
    } finally {
      setSubmittingPolicy(false);
    }
  };

  return (
    <div className="container-fluid py-4 px-lg-5">
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
        <div>
          <h3 className="fw-bolder mb-1 text-slate-900">Warranty & Customer Guarantees</h3>
          <p className="text-muted small mb-0">
            Review customer claims, authorize replacements or repairs, and configure official store warranty terms.
          </p>
        </div>
        {isAdmin && activeTab === 'policies' && (
          <button
            onClick={() => setShowPolicyModal(true)}
            className="btn btn-primary rounded-pill px-4 fw-bold shadow-sm d-flex align-items-center gap-2"
          >
            <i className="bi bi-shield-plus"></i> New Warranty Policy
          </button>
        )}
      </div>

      {feedback.text && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show rounded-3 small`} role="alert">
          {feedback.text}
          <button type="button" className="btn-close" onClick={() => setFeedback({ type: '', text: '' })}></button>
        </div>
      )}

      {/* Tabs */}
      <ul className="nav nav-pills mb-4 gap-2">
        <li className="nav-item">
          <button
            className={`btn btn-sm rounded-pill px-4 fw-bold ${
              activeTab === 'claims' ? 'btn-primary' : 'btn-light border'
            }`}
            onClick={() => setActiveTab('claims')}
          >
            <i className="bi bi-shield-exclamation me-1"></i> Customer Warranty Claims ({claims.length})
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`btn btn-sm rounded-pill px-4 fw-bold ${
              activeTab === 'policies' ? 'btn-primary' : 'btn-light border'
            }`}
            onClick={() => setActiveTab('policies')}
          >
            <i className="bi bi-file-earmark-lock me-1"></i> Configured Policies ({policies.length})
          </button>
        </li>
      </ul>

      {/* TAB 1: CLAIMS */}
      {activeTab === 'claims' && (
        <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
          <div className="p-3.5 border-bottom bg-slate-50 d-flex justify-content-between align-items-center">
            <span className="fw-bold text-slate-800 small">Warranty Claims Ledger</span>
            <button onClick={fetchData} className="btn btn-sm btn-light rounded-pill border">
              <i className="bi bi-arrow-clockwise"></i> Refresh
            </button>
          </div>

          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status"></div>
              <p className="text-muted small mt-2">Loading warranty claims...</p>
            </div>
          ) : claims.length === 0 ? (
            <div className="text-center py-5 text-muted small">
              No warranty claims have been submitted by customers yet.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0 text-sm">
                <thead className="table-light text-slate-600 text-xs">
                  <tr>
                    <th className="ps-4">Claim #</th>
                    <th>Customer</th>
                    <th>Product Item</th>
                    <th>Warranty Policy</th>
                    <th>Submitted</th>
                    <th>Status</th>
                    <th className="text-end pe-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map((c) => (
                    <tr key={c.id}>
                      <td className="ps-4">
                        <strong className="text-primary">{c.claim_number}</strong>
                      </td>
                      <td>
                        <div className="fw-semibold text-slate-900">{c.customer_name || 'Customer'}</div>
                        <small className="text-muted">{c.customer_email}</small>
                      </td>
                      <td>
                        <div className="fw-semibold text-slate-800">{c.product_name}</div>
                        <small className="text-muted">Order Item #{c.order_item}</small>
                      </td>
                      <td>
                        <span className="badge bg-cyan-100 text-cyan-800 rounded-pill px-2.5 py-1 text-xs">
                          {c.warranty_coverage || 'Standard Warranty'}
                        </span>
                      </td>
                      <td>
                        <small className="text-muted">{new Date(c.created_at).toLocaleDateString()}</small>
                      </td>
                      <td>
                        <span
                          className={`badge rounded-pill px-2.5 py-1 text-xs ${
                            c.status === 'APPROVED' || c.status === 'RESOLVED'
                              ? 'bg-success'
                              : c.status === 'REJECTED'
                              ? 'bg-danger'
                              : c.status === 'UNDER_REVIEW'
                              ? 'bg-info text-dark'
                              : 'bg-warning text-dark'
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="text-end pe-4">
                        <button
                          onClick={() => handleOpenClaimModal(c)}
                          className="btn btn-sm btn-outline-primary rounded-pill px-3 text-xs"
                        >
                          Review & Action
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: POLICIES */}
      {activeTab === 'policies' && (
        <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
          <div className="p-3.5 border-bottom bg-slate-50 d-flex justify-content-between align-items-center">
            <span className="fw-bold text-slate-800 small">Official Warranty Policies ({policies.length})</span>
            <button onClick={fetchData} className="btn btn-sm btn-light rounded-pill border">
              <i className="bi bi-arrow-clockwise"></i> Refresh
            </button>
          </div>

          <div className="p-4">
            <div className="row g-4">
              {policies.map((p) => (
                <div key={p.id} className="col-md-6 col-lg-4">
                  <div className="card h-100 border rounded-4 p-4 shadow-sm position-relative">
                    {p.is_default && (
                      <span className="position-absolute top-0 end-0 m-3 badge bg-primary rounded-pill px-2.5 py-1 text-xs">
                        Default Policy
                      </span>
                    )}
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <i className="bi bi-shield-check text-primary fs-4"></i>
                      <h5 className="fw-bold mb-0 text-slate-900">{p.name}</h5>
                    </div>
                    <div className="mb-3">
                      <span className="badge bg-slate-100 text-slate-700 px-2.5 py-1 rounded-pill fw-bold">
                        {p.duration_days} Days Coverage
                      </span>
                    </div>
                    <p className="text-secondary small mb-3" style={{ lineHeight: '1.6' }}>
                      {p.coverage_summary || 'Standard replacement and hardware guarantee.'}
                    </p>
                    <div className="text-xs text-muted mt-auto pt-2 border-top">
                      <strong>Claim Instructions:</strong> {p.claim_instructions || 'File claim through customer portal.'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Review Claim Modal */}
      {selectedClaim && (
        <div
          className="modal show d-block"
          style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(3px)' }}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content rounded-4 border-0 shadow-lg">
              <div className="modal-header border-bottom px-4 py-3">
                <h5 className="modal-title fw-bold">
                  Review Warranty Claim: {selectedClaim.claim_number}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setSelectedClaim(null)}
                ></button>
              </div>
              <form onSubmit={handleUpdateClaim}>
                <div className="modal-body p-4">
                  <div className="p-3 bg-light rounded-3 mb-3">
                    <div className="row g-2 text-xs">
                      <div className="col-sm-6">
                        <strong>Product:</strong> {selectedClaim.product_name}
                      </div>
                      <div className="col-sm-6">
                        <strong>Customer:</strong> {selectedClaim.customer_name} ({selectedClaim.customer_email})
                      </div>
                      <div className="col-sm-6">
                        <strong>Policy:</strong> {selectedClaim.warranty_coverage}
                      </div>
                      <div className="col-sm-6">
                        <strong>Claim Date:</strong> {new Date(selectedClaim.created_at).toLocaleString()}
                      </div>
                    </div>
                    <hr className="my-2" />
                    <div className="text-xs">
                      <strong>Customer's Issue Description:</strong>
                      <p className="mt-1 mb-0 text-slate-800">{selectedClaim.issue_description}</p>
                    </div>
                  </div>

                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-bold">Update Claim Status *</label>
                      <select
                        className="form-select"
                        value={claimStatus}
                        onChange={(e) => setClaimStatus(e.target.value)}
                        required
                      >
                        <option value="PENDING">Pending Initial Review</option>
                        <option value="UNDER_REVIEW">Under Technical Investigation</option>
                        <option value="APPROVED">Approved (Replacement / Repair)</option>
                        <option value="REJECTED">Rejected (Out of Scope / Void)</option>
                        <option value="RESOLVED">Resolved & Closed</option>
                      </select>
                    </div>

                    <div className="col-12">
                      <label className="form-label small fw-bold">Internal Staff / Admin Notes</label>
                      <textarea
                        className="form-control"
                        rows="2"
                        placeholder="Internal notes about the inspection..."
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                      ></textarea>
                    </div>

                    {claimStatus === 'REJECTED' && (
                      <div className="col-12">
                        <label className="form-label small fw-bold text-danger">Rejection Reason *</label>
                        <textarea
                          className="form-control border-danger"
                          rows="2"
                          placeholder="Explain to customer why the claim was not approved..."
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          required
                        ></textarea>
                      </div>
                    )}

                    {['APPROVED', 'RESOLVED'].includes(claimStatus) && (
                      <div className="col-12">
                        <label className="form-label small fw-bold text-success">
                          Resolution / Replacement Details
                        </label>
                        <textarea
                          className="form-control border-success"
                          rows="2"
                          placeholder="e.g. Free replacement shipped via Addis Express or repair completed."
                          value={resolutionDetails}
                          onChange={(e) => setResolutionDetails(e.target.value)}
                        ></textarea>
                      </div>
                    )}
                  </div>
                </div>
                <div className="modal-footer border-top px-4 py-3">
                  <button
                    type="button"
                    className="btn btn-light rounded-pill px-4"
                    onClick={() => setSelectedClaim(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary rounded-pill px-4 fw-bold"
                    disabled={updatingClaim}
                  >
                    {updatingClaim ? 'Saving Decision...' : 'Save Decision'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* New Policy Modal (Admin only) */}
      {showPolicyModal && (
        <div
          className="modal show d-block"
          style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(3px)' }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 border-0 shadow-lg">
              <div className="modal-header border-bottom px-4 py-3">
                <h5 className="modal-title fw-bold">Create Warranty Policy</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowPolicyModal(false)}
                ></button>
              </div>
              <form onSubmit={handleCreatePolicy}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label small fw-bold">Policy Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. 7-Day Replacement Guarantee"
                      value={policyForm.name}
                      onChange={(e) => setPolicyForm({ ...policyForm, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold">Duration (Days) *</label>
                    <input
                      type="number"
                      min="1"
                      className="form-control"
                      placeholder="e.g. 7, 30, or 365"
                      value={policyForm.duration_days}
                      onChange={(e) => setPolicyForm({ ...policyForm, duration_days: e.target.value })}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold">Coverage Summary *</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      placeholder="Summary of what is covered (factory defects, hardware failures)..."
                      value={policyForm.coverage_summary}
                      onChange={(e) => setPolicyForm({ ...policyForm, coverage_summary: e.target.value })}
                      required
                    ></textarea>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold">Claim Instructions</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      placeholder="How customers can submit claims..."
                      value={policyForm.claim_instructions}
                      onChange={(e) => setPolicyForm({ ...policyForm, claim_instructions: e.target.value })}
                    ></textarea>
                  </div>

                  <div className="form-check form-switch mt-2">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="defaultPolicySwitch"
                      checked={policyForm.is_default}
                      onChange={(e) => setPolicyForm({ ...policyForm, is_default: e.target.checked })}
                    />
                    <label className="form-check-label small fw-bold" htmlFor="defaultPolicySwitch">
                      Set as Store Default Policy
                    </label>
                  </div>
                </div>
                <div className="modal-footer border-top px-4 py-3">
                  <button
                    type="button"
                    className="btn btn-light rounded-pill px-4"
                    onClick={() => setShowPolicyModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary rounded-pill px-4 fw-bold"
                    disabled={submittingPolicy}
                  >
                    {submittingPolicy ? 'Creating...' : 'Save Policy'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerWarrantyPage;
