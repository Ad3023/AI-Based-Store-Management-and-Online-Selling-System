import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import { formatETB } from '../../utils/currency';

const DriverDashboardPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [shipments, setShipments] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('active'); // 'active', 'in_transit', 'delivered', 'all'
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Status Update Modal State
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [submittingUpdate, setSubmittingUpdate] = useState(false);

  // Fetch Driver Profile
  const fetchProfile = useCallback(async () => {
    try {
      const res = await api.get('delivery/driver/profile/');
      setProfile(res.data);
    } catch (err) {
      console.error('Failed to load driver profile:', err);
    }
  }, []);

  // Fetch Assigned Deliveries
  const fetchShipments = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      let url = 'delivery/driver/shipments/';
      if (statusFilter) {
        url += `?status=${statusFilter}`;
      }
      const res = await api.get(url);
      setShipments(res.data.results || res.data || []);
    } catch (err) {
      console.error('Failed to load driver shipments:', err);
      setFeedback({ type: 'danger', text: 'Failed to load assigned deliveries.' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchProfile();
    fetchShipments();
  }, [fetchProfile, fetchShipments]);

  // Toggle Driver Availability
  const handleToggleAvailability = async () => {
    if (!profile) return;
    const newStatus = !profile.is_available;
    try {
      await api.patch('delivery/driver/profile/', { is_available: newStatus });
      setProfile((prev) => ({ ...prev, is_available: newStatus }));
      setFeedback({
        type: 'success',
        text: newStatus ? 'You are now marked AVAILABLE for deliveries.' : 'You are now marked BUSY / UNAVAILABLE.',
      });
    } catch (err) {
      setFeedback({ type: 'danger', text: 'Failed to update availability status.' });
    }
  };

  // Open Status Update Modal
  const handleOpenUpdate = (shipment, newStatus) => {
    setSelectedShipment(shipment);
    setTargetStatus(newStatus);
    setConfirmationCode('');
    setDeliveryNote('');
    setUpdateModalOpen(true);
  };

  // Submit Status Update
  const handleSubmitStatus = async (e) => {
    e.preventDefault();
    if (!selectedShipment || !targetStatus) return;

    if (targetStatus === 'DELIVERED' && !confirmationCode.trim()) {
      alert('Please enter the 6-digit confirmation code provided by the customer.');
      return;
    }
    if (targetStatus === 'FAILED' && !deliveryNote.trim()) {
      alert('Please provide a reason or note explaining why the delivery could not be completed.');
      return;
    }

    try {
      setSubmittingUpdate(true);
      const payload = {
        status: targetStatus,
        confirmation_code: confirmationCode.trim(),
        delivery_note: deliveryNote.trim(),
        location: profile?.current_city || selectedShipment.destination_city || 'Addis Ababa',
      };

      await api.post(`delivery/driver/shipments/${selectedShipment.id}/update-status/`, payload);
      setFeedback({
        type: 'success',
        text: `Shipment ${selectedShipment.tracking_number} updated to ${targetStatus}!`,
      });
      setUpdateModalOpen(false);
      fetchShipments(true);
      fetchProfile();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update shipment status.');
    } finally {
      setSubmittingUpdate(false);
    }
  };

  // Filter shipments by search query
  const filteredShipments = shipments.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.order_number?.toLowerCase().includes(q) ||
      s.tracking_number?.toLowerCase().includes(q) ||
      s.recipient_name?.toLowerCase().includes(q) ||
      s.recipient_phone?.includes(q) ||
      s.delivery_address?.toLowerCase().includes(q)
    );
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ASSIGNED':
        return <span className="badge bg-primary text-white px-2.5 py-1">Assigned (Ready)</span>;
      case 'PICKED_UP':
        return <span className="badge bg-info text-dark px-2.5 py-1">Picked Up</span>;
      case 'IN_TRANSIT':
      case 'OUT_FOR_DELIVERY':
        return <span className="badge bg-warning text-dark px-2.5 py-1">In Transit / En Route</span>;
      case 'DELIVERED':
        return <span className="badge bg-success text-white px-2.5 py-1">Delivered</span>;
      case 'FAILED':
      case 'FAILED_DELIVERY':
      case 'DELIVERY_ATTEMPT_FAILED':
        return <span className="badge bg-danger text-white px-2.5 py-1">Failed Attempt</span>;
      default:
        return <span className="badge bg-secondary text-white px-2.5 py-1">{status}</span>;
    }
  };

  return (
    <div className="min-vh-100 bg-slate-50 pb-5">
      {/* Top Driver App Bar */}
      <header className="bg-slate-900 text-white sticky-top shadow-sm z-3 py-2.5 px-3 px-md-4">
        <div className="container-fluid d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2.5">
            <div
              className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center shadow-sm"
              style={{ width: '38px', height: '38px' }}
            >
              <i className="bi bi-bicycle fs-5"></i>
            </div>
            <div>
              <div className="fw-bolder lh-1 text-sm text-white">
                EthioTech <span className="text-info">Driver Portal</span>
              </div>
              <small className="text-slate-400 text-xs">
                {profile?.full_name || user?.get_full_name || user?.username} ({profile?.vehicle_registration_number || 'Motorcycle'})
              </small>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2">
            <button
              onClick={() => fetchShipments(true)}
              className="btn btn-sm btn-outline-light rounded-pill px-2.5 py-1 text-xs d-flex align-items-center gap-1"
              title="Refresh Tasks"
            >
              <i className={`bi bi-arrow-clockwise ${refreshing ? 'spin' : ''}`}></i>
              <span className="d-none d-sm-inline">Refresh</span>
            </button>
            <button
              onClick={() => {
                logout();
                navigate('/driver/login');
              }}
              className="btn btn-sm btn-outline-danger rounded-pill px-2.5 py-1 text-xs"
            >
              <i className="bi bi-box-arrow-right me-1"></i> Sign Out
            </button>
          </div>
        </div>
      </header>

      <div className="container py-3 py-md-4" style={{ maxWidth: '900px' }}>
        {/* Driver Status Banner */}
        <div className="card border-0 shadow-sm rounded-4 p-3 mb-3 bg-white border border-slate-200">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
            <div className="d-flex align-items-center gap-3">
              <div
                className={`rounded-circle d-flex align-items-center justify-content-center ${
                  profile?.is_available ? 'bg-success bg-opacity-10 text-success' : 'bg-secondary bg-opacity-10 text-secondary'
                }`}
                style={{ width: '44px', height: '44px' }}
              >
                <i className={`bi ${profile?.is_available ? 'bi-check-circle-fill' : 'bi-pause-circle-fill'} fs-4`}></i>
              </div>
              <div>
                <h6 className="fw-bold mb-0 text-slate-900">
                  {profile?.is_available ? 'You are Available for Deliveries' : 'You are currently Offline / Busy'}
                </h6>
                <small className="text-muted text-xs">
                  Area: {profile?.delivery_area || profile?.current_city || 'Addis Ababa Central Zone'}
                </small>
              </div>
            </div>

            <button
              onClick={handleToggleAvailability}
              className={`btn btn-sm rounded-pill px-3 py-1.5 fw-bold text-xs d-flex align-items-center gap-1.5 ${
                profile?.is_available ? 'btn-outline-secondary' : 'btn-success'
              }`}
            >
              <i className={`bi ${profile?.is_available ? 'bi-toggle-on text-success' : 'bi-toggle-off'} fs-6`}></i>
              <span>{profile?.is_available ? 'Go Offline' : 'Go Online'}</span>
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback.text && (
          <div className={`alert alert-${feedback.type} alert-dismissible fade show rounded-3 py-2 px-3 text-xs`} role="alert">
            <i className={`bi ${feedback.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} me-1.5`}></i>
            {feedback.text}
            <button type="button" className="btn-close py-2" onClick={() => setFeedback({ type: '', text: '' })}></button>
          </div>
        )}

        {/* Counter KPI Cards */}
        <div className="row g-2 mb-3 text-center">
          <div className="col-4">
            <div className="card border-0 shadow-sm rounded-3 p-2.5 bg-white border-start border-4 border-primary">
              <span className="text-muted text-[11px] text-uppercase fw-semibold">Active Tasks</span>
              <h4 className="fw-bolder text-primary mb-0 mt-1">{profile?.active_deliveries_count ?? 0}</h4>
            </div>
          </div>
          <div className="col-4">
            <div className="card border-0 shadow-sm rounded-3 p-2.5 bg-white border-start border-4 border-warning">
              <span className="text-muted text-[11px] text-uppercase fw-semibold">Vehicle</span>
              <h6 className="fw-bold text-slate-800 mb-0 mt-1.5 text-truncate font-mono">
                {profile?.vehicle_registration_number || 'AA-3'}
              </h6>
            </div>
          </div>
          <div className="col-4">
            <div className="card border-0 shadow-sm rounded-3 p-2.5 bg-white border-start border-4 border-success">
              <span className="text-muted text-[11px] text-uppercase fw-semibold">Delivered</span>
              <h4 className="fw-bolder text-success mb-0 mt-1">{profile?.completed_deliveries_count ?? 0}</h4>
            </div>
          </div>
        </div>

        {/* Search & Status Filter Tabs */}
        <div className="card border-0 shadow-sm rounded-4 p-3 mb-3 bg-white">
          <div className="mb-2">
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-light border-end-0"><i className="bi bi-search text-muted"></i></span>
              <input
                type="text"
                className="form-control bg-light border-start-0"
                placeholder="Search by order ID, customer name, phone, address..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button className="btn btn-outline-secondary" onClick={() => setSearch('')}>Clear</button>
              )}
            </div>
          </div>

          <div className="d-flex gap-1 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            <button
              className={`btn btn-xs rounded-pill px-3 py-1 font-bold text-xs ${
                statusFilter === 'active' ? 'btn-primary shadow-sm' : 'btn-light text-slate-600'
              }`}
              onClick={() => setStatusFilter('active')}
            >
              Active Tasks
            </button>
            <button
              className={`btn btn-xs rounded-pill px-3 py-1 font-bold text-xs ${
                statusFilter === 'in_transit' ? 'btn-primary shadow-sm' : 'btn-light text-slate-600'
              }`}
              onClick={() => setStatusFilter('in_transit')}
            >
              En Route
            </button>
            <button
              className={`btn btn-xs rounded-pill px-3 py-1 font-bold text-xs ${
                statusFilter === 'delivered' ? 'btn-primary shadow-sm' : 'btn-light text-slate-600'
              }`}
              onClick={() => setStatusFilter('delivered')}
            >
              Completed
            </button>
            <button
              className={`btn btn-xs rounded-pill px-3 py-1 font-bold text-xs ${
                statusFilter === 'all' ? 'btn-primary shadow-sm' : 'btn-light text-slate-600'
              }`}
              onClick={() => setStatusFilter('all')}
            >
              All Deliveries
            </button>
          </div>
        </div>

        {/* Delivery Cards List */}
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status"></div>
            <p className="text-muted text-xs mt-2">Loading your deliveries...</p>
          </div>
        ) : filteredShipments.length === 0 ? (
          <div className="card border-0 shadow-sm rounded-4 p-5 text-center bg-white">
            <i className="bi bi-inbox fs-1 text-muted mb-2"></i>
            <h6 className="fw-bold text-slate-800">No Deliveries Found</h6>
            <p className="text-muted text-xs mb-3">
              {statusFilter === 'active'
                ? "You have no active deliveries assigned right now. You will be notified when new customer orders are dispatched."
                : "No deliveries matching the selected filter."}
            </p>
            <button onClick={() => fetchShipments(true)} className="btn btn-outline-primary btn-sm rounded-pill px-3">
              Check for New Assignments
            </button>
          </div>
        ) : (
          <div className="d-flex flex-column gap-3">
            {filteredShipments.map((s) => (
              <div key={s.id} className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white border border-slate-200">
                {/* Card Header */}
                <div className="card-header bg-white py-2.5 px-3 px-md-4 d-flex align-items-center justify-content-between border-bottom">
                  <div>
                    <span className="fw-bold font-mono text-slate-900 text-sm">{s.order_number}</span>
                    <span className="text-muted text-xs ms-2 d-none d-sm-inline">Tracking: {s.tracking_number}</span>
                  </div>
                  <div>{getStatusBadge(s.status)}</div>
                </div>

                {/* Card Body */}
                <div className="card-body p-3 p-md-4">
                  <div className="row g-3">
                    {/* Customer & Address */}
                    <div className="col-12 col-md-6">
                      <div className="d-flex align-items-start gap-2.5 mb-2">
                        <i className="bi bi-person-circle fs-5 text-primary mt-0.5"></i>
                        <div>
                          <div className="fw-bold text-slate-900">{s.recipient_name}</div>
                          <div className="text-slate-600 text-xs mt-0.5">
                            <a
                              href={`tel:${s.recipient_phone}`}
                              className="btn btn-sm btn-outline-success rounded-pill px-2.5 py-0.5 text-xs text-decoration-none mt-1 d-inline-flex align-items-center gap-1"
                            >
                              <i className="bi bi-telephone-fill"></i> Call {s.recipient_phone}
                            </a>
                          </div>
                        </div>
                      </div>

                      <div className="d-flex align-items-start gap-2.5 mt-2.5">
                        <i className="bi bi-geo-alt-fill fs-5 text-danger mt-0.5"></i>
                        <div>
                          <div className="fw-semibold text-slate-800 text-xs">{s.delivery_address || 'Address provided at order'}</div>
                          <small className="text-muted text-[11px]">{s.destination_city || 'Addis Ababa'}</small>
                        </div>
                      </div>
                    </div>

                    {/* Order Details & Delivery Notes */}
                    <div className="col-12 col-md-6 border-start-md ps-md-4">
                      <div className="mb-2">
                        <span className="text-muted text-[11px] text-uppercase fw-bold">Package Contents</span>
                        <div className="mt-1 bg-light rounded-3 p-2 text-xs">
                          {s.order_items && s.order_items.length > 0 ? (
                            s.order_items.map((it, idx) => (
                              <div key={idx} className="d-flex justify-content-between text-slate-700 py-0.5">
                                <span className="text-truncate" style={{ maxWidth: '200px' }}>
                                  {it.quantity}x {it.product_name}
                                </span>
                                <span className="font-mono">{formatETB(it.subtotal || (it.unit_price * it.quantity))}</span>
                              </div>
                            ))
                          ) : (
                            <span className="text-muted">Standard Electronics Package</span>
                          )}
                          <div className="border-top pt-1 mt-1 d-flex justify-content-between fw-bold text-slate-900">
                            <span>Total Payable</span>
                            <span className="text-primary">{formatETB(s.order_total || 0)}</span>
                          </div>
                          <small className="text-muted d-block mt-0.5" style={{ fontSize: '10px' }}>
                            Payment: {s.order_payment_status === 'PAID' ? 'PAID ONLINE (No cash required)' : 'CASH ON DELIVERY / VERIFY'}
                          </small>
                        </div>
                      </div>

                      {s.estimated_delivery_date && (
                        <div className="text-xs text-muted mb-1">
                          <i className="bi bi-calendar-event me-1"></i>
                          Expected: <strong>{s.estimated_delivery_date}</strong>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Driver Milestone Action Buttons */}
                  <div className="border-top pt-3 mt-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
                    <div className="text-muted text-[11px]">
                      {s.status === 'ASSIGNED' && 'Package ready for pickup at fulfillment dock.'}
                      {s.status === 'PICKED_UP' && 'Package collected. Ready to depart for customer address.'}
                      {(s.status === 'IN_TRANSIT' || s.status === 'OUT_FOR_DELIVERY') && 'En route. Obtain customer 6-digit confirmation code at delivery.'}
                      {s.status === 'DELIVERED' && <span className="text-success fw-bold"><i className="bi bi-check-circle-fill me-1"></i>Delivered successfully.</span>}
                      {s.status === 'FAILED' && <span className="text-danger fw-bold"><i className="bi bi-exclamation-octagon-fill me-1"></i>Delivery attempt failed.</span>}
                    </div>

                    <div className="d-flex align-items-center gap-1.5 flex-wrap">
                      {s.status === 'ASSIGNED' && (
                        <button
                          onClick={() => handleOpenUpdate(s, 'PICKED_UP')}
                          className="btn btn-sm btn-info text-dark rounded-pill px-3 py-1 font-bold text-xs"
                        >
                          <i className="bi bi-box-arrow-up-right me-1"></i> Pick Up Package
                        </button>
                      )}

                      {s.status === 'PICKED_UP' && (
                        <button
                          onClick={() => handleOpenUpdate(s, 'IN_TRANSIT')}
                          className="btn btn-sm btn-warning text-dark rounded-pill px-3 py-1 font-bold text-xs"
                        >
                          <i className="bi bi-truck me-1"></i> Start Delivery (En Route)
                        </button>
                      )}

                      {(s.status === 'IN_TRANSIT' || s.status === 'OUT_FOR_DELIVERY') && (
                        <>
                          <button
                            onClick={() => handleOpenUpdate(s, 'DELIVERED')}
                            className="btn btn-sm btn-success rounded-pill px-3.5 py-1.5 font-bold text-xs shadow-sm"
                          >
                            <i className="bi bi-shield-check me-1"></i> Confirm Delivered
                          </button>
                          <button
                            onClick={() => handleOpenUpdate(s, 'FAILED')}
                            className="btn btn-sm btn-outline-danger rounded-pill px-2.5 py-1 text-xs"
                          >
                            <i className="bi bi-x-circle me-1"></i> Report Issue / Failed
                          </button>
                        </>
                      )}

                      {s.status === 'FAILED' && (
                        <button
                          onClick={() => handleOpenUpdate(s, 'IN_TRANSIT')}
                          className="btn btn-sm btn-outline-warning rounded-pill px-3 py-1 text-xs font-bold"
                        >
                          <i className="bi bi-arrow-repeat me-1"></i> Re-attempt Delivery
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* STATUS UPDATE & CONFIRMATION MODAL */}
      {/* ============================================================== */}
      {updateModalOpen && selectedShipment && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 border-0 shadow">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold text-slate-900">
                  {targetStatus === 'DELIVERED' && 'Confirm Package Delivery'}
                  {targetStatus === 'PICKED_UP' && 'Confirm Package Pickup'}
                  {targetStatus === 'IN_TRANSIT' && 'Start Delivery (En Route)'}
                  {targetStatus === 'FAILED' && 'Report Failed Delivery Attempt'}
                </h5>
                <button type="button" className="btn-close" onClick={() => setUpdateModalOpen(false)}></button>
              </div>

              <form onSubmit={handleSubmitStatus}>
                <div className="modal-body text-sm">
                  <div className="p-2.5 bg-light rounded-3 mb-3 border text-xs">
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-muted">Order Number:</span>
                      <strong className="font-mono text-slate-800">{selectedShipment.order_number}</strong>
                    </div>
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-muted">Customer:</span>
                      <strong>{selectedShipment.recipient_name}</strong>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span className="text-muted">Address:</span>
                      <span className="text-truncate" style={{ maxWidth: '240px' }}>{selectedShipment.delivery_address}</span>
                    </div>
                  </div>

                  {targetStatus === 'DELIVERED' && (
                    <div className="mb-3 p-3 bg-success bg-opacity-10 border border-success border-opacity-25 rounded-3">
                      <label className="form-label fw-bold text-success d-flex align-items-center gap-1.5 mb-1">
                        <i className="bi bi-key-fill"></i> Customer Confirmation Code *
                      </label>
                      <p className="text-muted text-[11px] mb-2">
                        Ask the customer at the delivery location for their 6-digit confirmation code displayed in their EthioTech order tracking.
                      </p>
                      <input
                        type="text"
                        maxLength="10"
                        className="form-control form-control-lg text-center font-mono fw-bold fs-4 tracking-widest"
                        placeholder="e.g. 529290"
                        required
                        value={confirmationCode}
                        onChange={(e) => setConfirmationCode(e.target.value.replace(/\D/g, ''))}
                        autoFocus
                      />
                    </div>
                  )}

                  {targetStatus === 'FAILED' && (
                    <div className="mb-3 p-3 bg-danger bg-opacity-10 border border-danger border-opacity-25 rounded-3">
                      <label className="form-label fw-bold text-danger mb-1">Failure Reason &amp; Driver Note *</label>
                      <p className="text-muted text-[11px] mb-2">
                        Explain why the package could not be delivered (e.g., customer unreachable, incorrect address, gate closed).
                      </p>
                      <textarea
                        className="form-control"
                        rows="3"
                        required
                        value={deliveryNote}
                        onChange={(e) => setDeliveryNote(e.target.value)}
                        placeholder="e.g. Called customer 3 times, phone switched off at destination gate."
                        autoFocus
                      />
                    </div>
                  )}

                  {targetStatus !== 'FAILED' && (
                    <div className="mb-2">
                      <label className="form-label fw-semibold text-xs">Delivery Note / Comments (Optional)</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={deliveryNote}
                        onChange={(e) => setDeliveryNote(e.target.value)}
                        placeholder={
                          targetStatus === 'DELIVERED'
                            ? 'Handed to customer in person'
                            : 'Package collected from store dock'
                        }
                      />
                    </div>
                  )}
                </div>

                <div className="modal-footer border-0 pt-0">
                  <button type="button" className="btn btn-light rounded-pill px-4 text-xs font-bold" onClick={() => setUpdateModalOpen(false)}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`btn rounded-pill px-4 text-xs font-bold ${
                      targetStatus === 'DELIVERED'
                        ? 'btn-success'
                        : targetStatus === 'FAILED'
                        ? 'btn-danger'
                        : 'btn-primary'
                    }`}
                    disabled={submittingUpdate}
                  >
                    {submittingUpdate ? (
                      <span><span className="spinner-border spinner-border-sm me-1"></span>Saving...</span>
                    ) : (
                      <span>Confirm {targetStatus}</span>
                    )}
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

export default DriverDashboardPage;

