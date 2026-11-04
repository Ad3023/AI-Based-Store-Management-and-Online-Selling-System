import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../api';
import { formatETB } from '../utils/currency';

const TrackOrderPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('tracking_number') || searchParams.get('order') || '';
  const [queryInput, setQueryInput] = useState(initialQuery);
  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  // Complaint Modal State
  const [complaintModalOpen, setComplaintModalOpen] = useState(false);
  const [complaintType, setComplaintType] = useState('DAMAGED');
  const [complaintDesc, setComplaintDesc] = useState('');
  const [submittingComplaint, setSubmittingComplaint] = useState(false);
  const [complaintSuccess, setComplaintSuccess] = useState('');

  const executeTrack = async (reference) => {
    if (!reference || !reference.trim()) return;
    try {
      setLoading(true);
      setError('');
      setSearched(true);
      const cleanRef = reference.trim();

      // First query dedicated public delivery tracking endpoint
      try {
        const res = await api.get(`delivery/track/?tracking_number=${encodeURIComponent(cleanRef)}`);
        if (res.data && res.data.tracking_number) {
          setShipment(res.data);
          return;
        }
      } catch (trackErr) {
        // Fallback: search standard orders endpoint if query was an order number
        const ordRes = await api.get(`orders/?search=${encodeURIComponent(cleanRef)}`);
        const results = ordRes.data.results || ordRes.data || [];
        const foundOrder = results.find(
          (o) =>
            o.order_number?.toLowerCase() === cleanRef.toLowerCase() ||
            String(o.id) === cleanRef ||
            o.tracking_number?.toLowerCase() === cleanRef.toLowerCase()
        ) || results[0];

        if (foundOrder && foundOrder.tracking_number) {
          const detailRes = await api.get(`delivery/track/?tracking_number=${encodeURIComponent(foundOrder.tracking_number)}`);
          if (detailRes.data) {
            setShipment(detailRes.data);
            return;
          }
        }
        throw new Error(`No shipment record found matching "${cleanRef}".`);
      }
    } catch (err) {
      console.error('Tracking lookup failed:', err);
      setShipment(null);
      setError(
        err.response?.data?.error ||
        `No shipment or verified order found matching reference "${reference}". Please check the tracking code or order number and try again.`
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialQuery) {
      executeTrack(initialQuery);
    }
  }, []);

  const handleTrackSubmit = (e) => {
    e.preventDefault();
    if (queryInput.trim()) {
      setSearchParams({ tracking_number: queryInput.trim() });
      executeTrack(queryInput.trim());
    }
  };

  const handleReportComplaint = async (e) => {
    e.preventDefault();
    if (!shipment) return;
    try {
      setSubmittingComplaint(true);
      await api.post('delivery/complaints/', {
        shipment_id: shipment.id,
        complaint_type: complaintType,
        description: complaintDesc,
      });
      setComplaintSuccess('Your delivery issue has been submitted to our Order Management team for immediate review.');
      setComplaintDesc('');
      setTimeout(() => {
        setComplaintModalOpen(false);
        setComplaintSuccess('');
        executeTrack(shipment.tracking_number);
      }, 2000);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to submit complaint. Please ensure you are logged in as the order owner.');
    } finally {
      setSubmittingComplaint(false);
    }
  };

  // 9-Stage Complete Delivery Journey Timeline
  const TIMELINE_STEPS = [
    { key: 'CONFIRMED', label: '1. Customer Places Order', icon: 'bi-bag-check-fill' },
    { key: 'READY_FOR_DISPATCH', label: '2. Store Manager Prepares & Packs', icon: 'bi-box-seam-fill' },
    { key: 'BOOKING_REQUESTED', label: '3. Order Manager Books Courier', icon: 'bi-envelope-paper-fill' },
    { key: 'BOOKING_CONFIRMED', label: '4. Courier Confirms Booking', icon: 'bi-check2-circle' },
    { key: 'PICKUP_SCHEDULED', label: '5. Courier Driver Pickup Scheduled', icon: 'bi-calendar-check-fill' },
    { key: 'PICKED_UP', label: '6. Driver Collects Package (Handover Verified)', icon: 'bi-box-arrow-up-right' },
    { key: 'IN_TRANSIT', label: '7. Transportation to Destination City', icon: 'bi-truck' },
    { key: 'OUT_FOR_DELIVERY', label: '8. Local Delivery in Destination City', icon: 'bi-bicycle' },
    { key: 'DELIVERED', label: '9. Customer Confirms Receipt (OTP Verified)', icon: 'bi-shield-fill-check' },
  ];

  const STATUS_RANK = {
    'PENDING': 0,
    'CONFIRMED': 1,
    'PROCESSING': 2,
    'READY_FOR_DISPATCH': 2,
    'BOOKING_REQUESTED': 3,
    'BOOKING_CONFIRMED': 4,
    'PICKUP_SCHEDULED': 5,
    'PICKED_UP': 6,
    'IN_TRANSIT': 7,
    'ARRIVED_AT_SORTING_CENTER': 7,
    'ARRIVED_AT_DESTINATION': 7,
    'OUT_FOR_DELIVERY': 8,
    'DELIVERY_ATTEMPT_FAILED': 8,
    'DELIVERED': 9,
    'RETURNED_TO_STORE': 9,
  };

  const STEP_RANK = {
    'CONFIRMED': 1,
    'READY_FOR_DISPATCH': 2,
    'BOOKING_REQUESTED': 3,
    'BOOKING_CONFIRMED': 4,
    'PICKUP_SCHEDULED': 5,
    'PICKED_UP': 6,
    'IN_TRANSIT': 7,
    'OUT_FOR_DELIVERY': 8,
    'DELIVERED': 9,
  };

  const getStepStatus = (stepKey, currentStatus) => {
    const curRank = STATUS_RANK[currentStatus] || 0;
    const thisRank = STEP_RANK[stepKey] || 0;

    if (currentStatus === 'DELIVERED') return 'completed';
    if (thisRank < curRank) return 'completed';
    if (thisRank === curRank) return 'current';
    return 'upcoming';
  };

  return (
    <div className="container py-4 pb-5 min-w-0" style={{ maxWidth: '980px' }}>
      {/* Header */}
      <div className="text-center mb-4">
        <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-1.5 rounded-pill text-xs font-bold mb-2">
          <i className="bi bi-shield-check me-1"></i> Real-Time Nationwide Logistics Tracking
        </span>
        <h2 className="fw-bolder mb-1 text-slate-900">Track Your Shipment Live</h2>
        <p className="text-muted small">
          Enter your unique tracking number (e.g. <code>ETH-2026-XXXXX</code>) or Order Number
        </p>
      </div>

      {/* Search Input Box */}
      <div className="card border-0 shadow-sm rounded-4 p-3 p-md-4 mb-4 bg-white border border-slate-200">
        <form onSubmit={handleTrackSubmit} className="row g-2 align-items-center">
          <div className="col-12 col-md-9">
            <div className="input-group">
              <span className="input-group-text bg-slate-50 border text-slate-400 ps-3 rounded-start-pill">
                <i className="bi bi-search"></i>
              </span>
              <input
                type="text"
                className="form-control bg-slate-50 border rounded-end-pill py-2.5 text-sm font-mono"
                placeholder="Enter Tracking # (e.g. ETH-2026-XXXXX) or Order #"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="col-12 col-md-3">
            <button
              type="submit"
              className="btn btn-primary w-100 rounded-pill py-2.5 font-bold text-xs shadow-sm"
              disabled={loading}
            >
              {loading ? (
                <span><span className="spinner-border spinner-border-sm me-2" role="status"></span>Tracking...</span>
              ) : (
                <span><i className="bi bi-arrow-right-circle me-1"></i> Track Live</span>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Error state */}
      {error && (
        <div className="card border-0 shadow-sm rounded-4 p-4 text-center mb-4 border border-danger-subtle bg-danger-subtle text-danger">
          <i className="bi bi-exclamation-circle-fill fs-2 mb-2"></i>
          <h5 className="fw-bold mb-1">Shipment Not Located</h5>
          <p className="small mb-0">{error}</p>
        </div>
      )}

      {/* Shipment Details Result */}
      {shipment && (
        <div className="row g-4">
          {/* Left Column: Shipment Overview, Items & OTP Alert */}
          <div className="col-12 col-lg-7">
            {/* 1. Primary Shipment Card */}
            <div className="card border-0 shadow-sm rounded-4 p-4 mb-4 bg-white border border-slate-200">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3 pb-3 border-bottom">
                <div>
                  <span className="text-muted text-xs d-block">Official Tracking Code</span>
                  <span className="h4 fw-bolder font-mono text-primary mb-0">{shipment.tracking_number}</span>
                </div>
                <div className="text-end">
                  <span className="text-muted text-xs d-block">Current Milestone</span>
                  <span
                    className={`badge px-3 py-1.5 text-xs font-bold rounded-pill ${
                      shipment.status === 'DELIVERED'
                        ? 'bg-success text-white'
                        : shipment.status === 'OUT_FOR_DELIVERY'
                        ? 'bg-primary text-white'
                        : shipment.status === 'DELIVERY_ATTEMPT_FAILED'
                        ? 'bg-danger text-white'
                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}
                  >
                    {shipment.status_display}
                  </span>
                </div>
              </div>

              {/* Corridor & Carrier Details */}
              <div className="row g-3 mb-3">
                <div className="col-6">
                  <span className="text-muted text-xs d-block"><i className="bi bi-geo-alt-fill text-primary me-1"></i>Origin Shop Hub</span>
                  <span className="fw-bold text-slate-800 text-sm">{shipment.origin_city}</span>
                </div>
                <div className="col-6">
                  <span className="text-muted text-xs d-block"><i className="bi bi-flag-fill text-danger me-1"></i>Destination City</span>
                  <span className="fw-bold text-slate-900 text-sm">{shipment.destination_city}</span>
                </div>
                <div className="col-6">
                  <span className="text-muted text-xs d-block">Logistics Method</span>
                  <span className="badge bg-light text-slate-700 border text-xs">{shipment.delivery_method_display}</span>
                </div>
                <div className="col-6">
                  <span className="text-muted text-xs d-block">Carrier Partner / Fleet</span>
                  <span className="fw-semibold text-slate-800 text-xs">
                    {shipment.courier_company?.name || shipment.courier_name || (shipment.vehicle ? `Own Fleet (${shipment.vehicle.registration_number})` : 'Assigned Courier')}
                  </span>
                </div>

                {/* Booking & Waybill Reference */}
                {(shipment.booking_reference || shipment.external_tracking_number) && (
                  <div className="col-12">
                    <div className="p-2.5 rounded-3 bg-slate-50 border text-xs d-flex flex-wrap justify-content-between align-items-center gap-2">
                      {shipment.booking_reference && (
                        <div>
                          <span className="text-muted me-1">Courier Booking Ref:</span>
                          <span className="font-mono fw-bold text-primary">{shipment.booking_reference}</span>
                        </div>
                      )}
                      {shipment.external_tracking_number && (
                        <div>
                          <span className="text-muted me-1">Courier Waybill #:</span>
                          <span className="font-mono fw-bold text-slate-800">{shipment.external_tracking_number}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Driver Pickup & Handover Info */}
                {shipment.pickup_driver_name && (
                  <div className="col-12">
                    <div className="p-2.5 rounded-3 bg-indigo-50 border border-indigo-100 text-xs d-flex justify-content-between align-items-center">
                      <div>
                        <span className="fw-bold text-indigo-900"><i className="bi bi-truck me-1"></i>Assigned Pickup Driver:</span>{' '}
                        <span className="text-slate-800 fw-semibold">{shipment.pickup_driver_name}</span>{' '}
                        {shipment.pickup_vehicle_plate && <span className="text-muted font-mono">({shipment.pickup_vehicle_plate})</span>}
                      </div>
                      {shipment.pickup_driver_phone && (
                        <a href={`tel:${shipment.pickup_driver_phone}`} className="btn btn-outline-primary btn-sm rounded-pill px-2.5 py-0.5 text-xs font-semibold">
                          <i className="bi bi-telephone-fill me-1"></i> Call Driver
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {shipment.handover_confirmed_at && (
                  <div className="col-12">
                    <div className="p-2 rounded-3 bg-success-subtle border border-success-subtle text-xs text-success fw-semibold d-flex align-items-center gap-1.5">
                      <i className="bi bi-check-circle-fill"></i>
                      <span>Physical Store Dock Handover Confirmed ({new Date(shipment.handover_confirmed_at).toLocaleString()})</span>
                    </div>
                  </div>
                )}

                {shipment.estimated_delivery_date && (
                  <div className="col-12">
                    <div className="p-2.5 rounded-3 bg-slate-50 border text-xs d-flex justify-content-between align-items-center">
                      <span className="text-muted">Estimated Delivery Arrival:</span>
                      <strong className="text-slate-800 font-mono">
                        {new Date(shipment.estimated_delivery_date).toLocaleDateString(undefined, {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Delivery Address */}
              <div className="p-3 bg-light rounded-3 border text-xs mb-3">
                <span className="text-muted d-block mb-1 font-semibold">Recipient Handover Details:</span>
                <div className="fw-bold text-slate-900">{shipment.recipient_name} ({shipment.recipient_phone})</div>
                <div className="text-slate-600 mt-0.5">{shipment.delivery_address}</div>
              </div>

              {/* Driver info if out for delivery */}
              {shipment.delivery_personnel && ['OUT_FOR_DELIVERY', 'DELIVERED'].includes(shipment.status) && (
                <div className="p-3 rounded-3 bg-primary-subtle border border-primary-subtle text-xs d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-2">
                    <div className="rounded-circle bg-primary text-white p-2 text-center" style={{ width: '32px', height: '32px' }}>
                      <i className="bi bi-person-fill"></i>
                    </div>
                    <div>
                      <div className="fw-bold text-slate-900">Local Delivery Agent: {shipment.delivery_personnel.full_name}</div>
                      <span className="text-muted font-mono">{shipment.delivery_personnel.employee_code} &bull; {shipment.delivery_personnel.current_city}</span>
                    </div>
                  </div>
                  <a href={`tel:${shipment.delivery_personnel.phone_number}`} className="btn btn-outline-primary btn-sm rounded-pill px-3 py-1 text-xs">
                    <i className="bi bi-telephone-fill me-1"></i> Call Driver
                  </a>
                </div>
              )}
            </div>

            {/* 2. Delivery OTP Handover Notice */}
            <div className="card border-0 shadow-sm rounded-4 p-3.5 mb-4 bg-white border border-slate-200">
              <div className="d-flex align-items-start gap-3">
                <div className="rounded-circle bg-success text-white p-2.5 text-center shrink-0">
                  <i className="bi bi-shield-lock-fill fs-5"></i>
                </div>
                <div>
                  <h6 className="fw-bold text-slate-900 mb-1">Customer Delivery OTP Verification</h6>
                  <p className="text-muted text-xs mb-2">
                    Our EthioTech Market secure delivery policy protects your order. When the delivery driver brings your package to your door:
                  </p>
                  <ol className="text-xs text-slate-700 ps-3 mb-2">
                    <li>Physically inspect the package condition and verify item contents.</li>
                    <li>Check your registered email for your secure 6-digit Delivery Handover OTP.</li>
                    <li>Share the OTP with the courier driver only after you have the product in hand.</li>
                  </ol>
                  <span className="badge bg-amber-50 text-amber-800 border border-amber-200 text-xs py-1">
                    <i className="bi bi-info-circle me-1"></i> Never share your OTP over phone before physical arrival.
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Ordered Products in Package */}
            <div className="card border-0 shadow-sm rounded-4 p-4 mb-4 bg-white border border-slate-200">
              <h6 className="fw-bold text-slate-900 mb-3">
                <i className="bi bi-bag-check me-2 text-primary"></i> Package Contents (Order #{shipment.order_number})
              </h6>
              <div className="d-flex flex-column gap-2.5">
                {(shipment.order_items || []).map((item) => (
                  <div key={item.id} className="d-flex align-items-center justify-content-between p-2 rounded-3 border bg-slate-50 text-xs">
                    <div className="d-flex align-items-center gap-2.5">
                      {item.product_image ? (
                        <img
                          src={item.product_image}
                          alt={item.product_name}
                          className="rounded-2 object-fit-cover border"
                          style={{ width: '42px', height: '42px' }}
                        />
                      ) : (
                        <div className="rounded-2 bg-slate-200 text-slate-500 d-flex align-items-center justify-content-center" style={{ width: '42px', height: '42px' }}>
                          <i className="bi bi-image"></i>
                        </div>
                      )}
                      <div>
                        <div className="fw-bold text-slate-900">{item.product_name}</div>
                        <span className="text-muted">Qty: {item.quantity} &bull; Warranty: {item.warranty_duration_days} days</span>
                      </div>
                    </div>
                    <span className="fw-bold text-slate-800">{formatETB(item.total_price)}</span>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="d-flex justify-content-between align-items-center mt-3 pt-3 border-top">
                <Link to={`/order/${shipment.order_id || shipment.order}`} className="btn btn-outline-secondary btn-sm rounded-pill px-3 py-1.5 text-xs">
                  <i className="bi bi-file-earmark-text me-1"></i> View Full Order
                </Link>
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm rounded-pill px-3 py-1.5 text-xs font-semibold"
                  onClick={() => setComplaintModalOpen(true)}
                >
                  <i className="bi bi-exclamation-diamond me-1"></i> Report Delivery Issue
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Dynamic Vertical Tracking Timeline */}
          <div className="col-12 col-lg-5">
            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white border border-slate-200">
              <h5 className="fw-bold text-slate-900 mb-1">
                <i className="bi bi-stopwatch text-primary me-2"></i> Vertical Tracking Timeline
              </h5>
              <p className="text-muted text-xs mb-4">Chronological event milestones from fulfillment to your door.</p>

              {/* Vertical Stepper */}
              <div className="position-relative ps-4 ms-2">
                {/* Vertical connecting line */}
                <div
                  className="position-absolute top-0 bottom-0 bg-slate-200"
                  style={{ left: '11px', width: '2px', zIndex: 0 }}
                />

                {TIMELINE_STEPS.map((step, idx) => {
                  const stepState = getStepStatus(step.key, shipment.status);
                  // Check if there is an actual event matching this status
                  const matchingEvent = (shipment.events || []).find((e) => {
                    if (step.key === 'IN_TRANSIT') {
                      return ['IN_TRANSIT', 'ARRIVED_AT_SORTING_CENTER', 'ARRIVED_AT_DESTINATION'].includes(e.status);
                    }
                    return e.status === step.key;
                  });

                  return (
                    <div key={idx} className="position-relative mb-4 ps-3" style={{ zIndex: 1 }}>
                      {/* Step Indicator Dot */}
                      <span
                        className={`position-absolute top-0 translate-middle rounded-circle d-flex align-items-center justify-content-center shadow-sm ${
                          stepState === 'completed'
                            ? 'bg-success text-white'
                            : stepState === 'current'
                            ? 'bg-primary text-white border-2 border-white'
                            : 'bg-white text-slate-300 border border-slate-300'
                        }`}
                        style={{ left: '-5px', width: '24px', height: '24px', fontSize: '11px' }}
                      >
                        <i className={`bi ${step.icon}`}></i>
                      </span>

                      {/* Content */}
                      <div>
                        <div
                          className={`text-xs ${
                            stepState === 'completed'
                              ? 'fw-bold text-success'
                              : stepState === 'current'
                              ? 'fw-bolder text-primary'
                              : 'text-slate-400 font-medium'
                          }`}
                        >
                          {step.label}
                        </div>

                        {matchingEvent ? (
                          <div className="mt-1">
                            <span className="text-muted text-xs font-mono d-block" style={{ fontSize: '0.7rem' }}>
                              <i className="bi bi-clock me-1"></i>
                              {new Date(matchingEvent.timestamp).toLocaleString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            <span className="text-slate-700 text-xs d-block mt-0.5">
                              <i className="bi bi-geo-alt me-1 text-primary"></i>{matchingEvent.location}
                            </span>
                            <span className="text-muted text-xs italic">{matchingEvent.description}</span>
                          </div>
                        ) : stepState === 'completed' || stepState === 'current' ? (
                          <span className="text-muted text-xs font-mono" style={{ fontSize: '0.7rem' }}>Milestone verified</span>
                        ) : (
                          <span className="text-slate-400 text-xs" style={{ fontSize: '0.7rem' }}>Pending progress</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Transit Delay / Attempt Failed Alert */}
              {shipment.status === 'DELIVERY_ATTEMPT_FAILED' && (
                <div className="alert alert-danger rounded-3 text-xs mt-3 mb-0" role="alert">
                  <div className="fw-bold mb-1"><i className="bi bi-exclamation-triangle-fill me-1"></i> Delivery Attempt Unsuccessful</div>
                  Our courier attempted delivery but was unable to complete handover (customer unavailable or phone unreachable). We will automatically reschedule the next delivery attempt.
                </div>
              )}

              {shipment.status === 'DELAYED' && (
                <div className="alert alert-warning rounded-3 text-xs mt-3 mb-0" role="alert">
                  <div className="fw-bold mb-1"><i className="bi bi-hourglass-split me-1"></i> Transit Delay Notice</div>
                  Your shipment has experienced a minor transportation delay along the regional highway corridor. Our logistics dispatch is actively routing the parcel.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Complaint / Report Issue Modal */}
      {complaintModalOpen && shipment && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 border-0 shadow">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold text-slate-900">
                  <i className="bi bi-exclamation-octagon text-danger me-2"></i> Report Delivery Problem
                </h5>
                <button type="button" className="btn-close" onClick={() => setComplaintModalOpen(false)}></button>
              </div>
              <form onSubmit={handleReportComplaint}>
                <div className="modal-body text-sm">
                  {complaintSuccess ? (
                    <div className="alert alert-success rounded-3 text-xs text-center py-3">
                      <i className="bi bi-check-circle-fill fs-3 d-block mb-2 text-success"></i>
                      {complaintSuccess}
                    </div>
                  ) : (
                    <>
                      <p className="text-muted text-xs mb-3">
                        Submit a complaint for shipment <strong>{shipment.tracking_number}</strong> (Order #{shipment.order_number}). Our Order Management team will immediately investigate.
                      </p>

                      <div className="mb-3">
                        <label className="form-label fw-semibold">Nature of Issue *</label>
                        <select
                          className="form-select"
                          value={complaintType}
                          onChange={(e) => setComplaintType(e.target.value)}
                        >
                          <option value="NOT_RECEIVED">Marked Delivered but NOT Received</option>
                          <option value="DAMAGED">Package Arrived Damaged / Torn Box</option>
                          <option value="MISSING_ITEMS">Items Missing from Parcel</option>
                          <option value="WRONG_PRODUCT">Received Incorrect Hardware Item</option>
                          <option value="DELAYED">Severe Unexplained Delivery Delay</option>
                          <option value="UNPROFESSIONAL_COURIER">Courier Conduct / Handover Issue</option>
                          <option value="OTHER">Other Delivery Concern</option>
                        </select>
                      </div>

                      <div className="mb-3">
                        <label className="form-label fw-semibold">Detailed Description *</label>
                        <textarea
                          className="form-control"
                          rows="3"
                          required
                          value={complaintDesc}
                          onChange={(e) => setComplaintDesc(e.target.value)}
                          placeholder="Please provide specifics about the delivery issue..."
                        />
                      </div>
                    </>
                  )}
                </div>
                <div className="modal-footer border-0 pt-0">
                  <button type="button" className="btn btn-light rounded-pill px-4 text-xs font-bold" onClick={() => setComplaintModalOpen(false)}>
                    Close
                  </button>
                  {!complaintSuccess && (
                    <button type="submit" className="btn btn-danger rounded-pill px-4 text-xs font-bold" disabled={submittingComplaint}>
                      {submittingComplaint ? 'Submitting...' : 'Submit Complaint'}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrackOrderPage;
