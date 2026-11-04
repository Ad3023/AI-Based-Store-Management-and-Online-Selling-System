import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api';
import { formatETB } from '../../utils/currency';

const OrderManagerShipmentsPage = () => {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Data helpers for assignment
  const [couriers, setCouriers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [personnel, setPersonnel] = useState([]);

  // Assignment Modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [assignMethod, setAssignMethod] = useState('THIRD_PARTY_COURIER');
  const [assignCourierId, setAssignCourierId] = useState('');
  const [assignExtTracking, setAssignExtTracking] = useState('');
  const [assignVehicleId, setAssignVehicleId] = useState('');
  const [assignPersonnelId, setAssignPersonnelId] = useState('');
  const [assignNotes, setAssignNotes] = useState('');

  // Milestone Update Modal
  const [milestoneModalOpen, setMilestoneModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventDescription, setEventDescription] = useState('');

  // Local Driver Assignment Modal
  const [localDriverModalOpen, setLocalDriverModalOpen] = useState(false);
  const [localPersonnelId, setLocalPersonnelId] = useState('');
  const [localDriverNotes, setLocalDriverNotes] = useState('');

  // OTP Verification Modal
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpSentInfo, setOtpSentInfo] = useState(null);

  // Failed Attempt Modal
  const [attemptModalOpen, setAttemptModalOpen] = useState(false);
  const [attemptReason, setAttemptReason] = useState('CUSTOMER_UNAVAILABLE');
  const [attemptNotes, setAttemptNotes] = useState('');
  const [nextAttemptDate, setNextAttemptDate] = useState('');

  // Tracking Detail Modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailShipment, setDetailShipment] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Stage 3: Courier Booking Modal
  const [bookCourierModalOpen, setBookCourierModalOpen] = useState(false);
  const [bookCourierId, setBookCourierId] = useState('');
  const [bookPickupDate, setBookPickupDate] = useState('');
  const [bookWeight, setBookWeight] = useState('2.5');
  const [bookDimensions, setBookDimensions] = useState('30x20x15 cm');
  const [bookNotes, setBookNotes] = useState('');
  const [submittingBooking, setSubmittingBooking] = useState(false);

  // Stage 4: Courier Booking Confirmation / Rejection Modal
  const [confirmBookingModalOpen, setConfirmBookingModalOpen] = useState(false);
  const [confirmBookingAction, setConfirmBookingAction] = useState('CONFIRM');
  const [confirmWaybill, setConfirmWaybill] = useState('');
  const [confirmDriverName, setConfirmDriverName] = useState('');
  const [confirmDriverPhone, setConfirmDriverPhone] = useState('');
  const [confirmVehiclePlate, setConfirmVehiclePlate] = useState('');
  const [confirmPickupScheduledAt, setConfirmPickupScheduledAt] = useState('');
  const [confirmRejectionReason, setConfirmRejectionReason] = useState('');
  const [confirmNotes, setConfirmNotes] = useState('');
  const [submittingConfirm, setSubmittingConfirm] = useState(false);

  // Stage 5: Driver Pickup Scheduling Modal
  const [schedulePickupModalOpen, setSchedulePickupModalOpen] = useState(false);
  const [schedDriverName, setSchedDriverName] = useState('');
  const [schedDriverPhone, setSchedDriverPhone] = useState('');
  const [schedVehiclePlate, setSchedVehiclePlate] = useState('');
  const [schedPickupAt, setSchedPickupAt] = useState('');
  const [schedNotes, setSchedNotes] = useState('');
  const [submittingSchedule, setSubmittingSchedule] = useState(false);

  const fetchShipments = useCallback(async () => {
    try {
      setLoading(true);
      let url = `delivery/shipments/?search=${encodeURIComponent(search)}`;
      if (statusFilter) url += `&status=${encodeURIComponent(statusFilter)}`;
      if (methodFilter) url += `&delivery_method=${encodeURIComponent(methodFilter)}`;
      const res = await api.get(url);
      setShipments(res.data.results || res.data || []);
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'danger', text: 'Failed to load shipments.' });
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, methodFilter]);

  const fetchAuxData = useCallback(async () => {
    try {
      const [cRes, vRes, pRes] = await Promise.all([
        api.get('delivery/couriers/?active_only=true'),
        api.get('delivery/vehicles/'),
        api.get('delivery/personnel/?available=true'),
      ]);
      setCouriers(cRes.data.results || cRes.data || []);
      setVehicles(vRes.data.results || vRes.data || []);
      setPersonnel(pRes.data.results || pRes.data || []);
    } catch (err) {
      console.error('Error fetching auxiliaries:', err);
    }
  }, []);

  useEffect(() => {
    fetchShipments();
    fetchAuxData();
  }, [fetchShipments, fetchAuxData]);

  // Open Assignment
  const handleOpenAssign = (shipment) => {
    setSelectedShipment(shipment);
    setAssignMethod(shipment.delivery_method || 'THIRD_PARTY_COURIER');
    setAssignCourierId(shipment.courier_company?.id || shipment.courier_company || '');
    setAssignExtTracking(shipment.external_tracking_number || '');
    setAssignVehicleId(shipment.vehicle?.id || shipment.vehicle || '');
    setAssignPersonnelId(shipment.delivery_personnel?.id || shipment.delivery_personnel || '');
    setAssignNotes('');
    setAssignModalOpen(true);
  };

  const handleSaveAssignment = async (e) => {
    e.preventDefault();
    if (!selectedShipment) return;
    try {
      await api.post(`delivery/orders/${selectedShipment.order}/assign/`, {
        delivery_method: assignMethod,
        courier_company_id: assignMethod === 'THIRD_PARTY_COURIER' ? Number(assignCourierId) : null,
        external_tracking_number: assignExtTracking,
        vehicle_id: assignMethod === 'OWN_DELIVERY' ? Number(assignVehicleId) : null,
        delivery_personnel_id: assignPersonnelId ? Number(assignPersonnelId) : null,
        notes: assignNotes,
      });
      setFeedback({ type: 'success', text: `Shipment ${selectedShipment.tracking_number} assignment updated.` });
      setAssignModalOpen(false);
      fetchShipments();
    } catch (err) {
      setFeedback({ type: 'danger', text: err.response?.data?.error || 'Failed to update assignment.' });
    }
  };

  // Open Stage 3: Book Courier
  const handleOpenBookCourier = (shipment) => {
    setSelectedShipment(shipment);
    const courierDefault = shipment.courier_company?.id || (couriers.length > 0 ? couriers[0].id : '');
    setBookCourierId(courierDefault);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const localIso = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setBookPickupDate(localIso);
    setBookWeight(shipment.total_weight_kg || '2.5');
    setBookDimensions(shipment.package_dimensions || '30x20x15 cm');
    setBookNotes(shipment.booking_notes || 'Fragile package from Addis Ababa Store Fulfillment Dock.');
    setBookCourierModalOpen(true);
  };

  const handleSaveBookCourier = async (e) => {
    e.preventDefault();
    if (!selectedShipment || !bookCourierId) return;
    try {
      setSubmittingBooking(true);
      const res = await api.post(`delivery/shipments/${selectedShipment.id}/book-courier/`, {
        courier_company_id: Number(bookCourierId),
        requested_pickup_date: bookPickupDate,
        package_weight_kg: Number(bookWeight),
        package_dimensions: bookDimensions,
        booking_notes: bookNotes,
      });
      setFeedback({ type: 'success', text: res.data.message || 'Courier booking request dispatched successfully!' });
      setBookCourierModalOpen(false);
      fetchShipments();
    } catch (err) {
      setFeedback({ type: 'danger', text: err.response?.data?.error || 'Failed to dispatch courier booking.' });
    } finally {
      setSubmittingBooking(false);
    }
  };

  // Open Stage 4: Confirm / Reject Booking
  const handleOpenConfirmBooking = (shipment) => {
    setSelectedShipment(shipment);
    setConfirmBookingAction('CONFIRM');
    setConfirmWaybill(shipment.external_tracking_number || `ABC-ET-${Math.floor(100000 + Math.random() * 900000)}`);
    setConfirmDriverName(shipment.pickup_driver_name || 'Abebe Bikila');
    setConfirmDriverPhone(shipment.pickup_driver_phone || '+251911223344');
    setConfirmVehiclePlate(shipment.pickup_vehicle_plate || 'AA-3-98765');
    const schedDate = shipment.pickup_scheduled_at ? new Date(shipment.pickup_scheduled_at) : new Date(Date.now() + 3600000 * 3);
    const localIso = new Date(schedDate.getTime() - schedDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setConfirmPickupScheduledAt(localIso);
    setConfirmRejectionReason('');
    setConfirmNotes('Booking verified and accepted by courier dispatch.');
    setConfirmBookingModalOpen(true);
  };

  const handleSaveConfirmBooking = async (e) => {
    e.preventDefault();
    if (!selectedShipment) return;
    try {
      setSubmittingConfirm(true);
      const isConfirmed = confirmBookingAction === 'CONFIRM';
      const payload = {
        confirmed: isConfirmed,
        notes: confirmNotes,
      };
      if (isConfirmed) {
        payload.external_tracking_number = confirmWaybill;
        payload.pickup_driver_name = confirmDriverName;
        payload.pickup_driver_phone = confirmDriverPhone;
        payload.pickup_vehicle_plate = confirmVehiclePlate;
        payload.pickup_scheduled_at = confirmPickupScheduledAt || null;
      } else {
        payload.rejection_reason = confirmRejectionReason || 'No courier vehicle capacity on requested date.';
      }
      const res = await api.post(`delivery/shipments/${selectedShipment.id}/confirm-booking/`, payload);
      setFeedback({ type: isConfirmed ? 'success' : 'warning', text: res.data.message || 'Courier response recorded.' });
      setConfirmBookingModalOpen(false);
      fetchShipments();
    } catch (err) {
      setFeedback({ type: 'danger', text: err.response?.data?.error || 'Failed to record courier response.' });
    } finally {
      setSubmittingConfirm(false);
    }
  };

  // Open Stage 5: Schedule Driver Pickup
  const handleOpenSchedulePickup = (shipment) => {
    setSelectedShipment(shipment);
    setSchedDriverName(shipment.pickup_driver_name || '');
    setSchedDriverPhone(shipment.pickup_driver_phone || '');
    setSchedVehiclePlate(shipment.pickup_vehicle_plate || '');
    const schedDate = shipment.pickup_scheduled_at ? new Date(shipment.pickup_scheduled_at) : new Date(Date.now() + 3600000 * 2);
    const localIso = new Date(schedDate.getTime() - schedDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setSchedPickupAt(localIso);
    setSchedNotes(shipment.booking_notes || '');
    setSchedulePickupModalOpen(true);
  };

  const handleSaveSchedulePickup = async (e) => {
    e.preventDefault();
    if (!selectedShipment) return;
    try {
      setSubmittingSchedule(true);
      const res = await api.post(`delivery/shipments/${selectedShipment.id}/schedule-pickup/`, {
        pickup_driver_name: schedDriverName,
        pickup_driver_phone: schedDriverPhone,
        pickup_vehicle_plate: schedVehiclePlate,
        pickup_scheduled_at: schedPickupAt,
        notes: schedNotes,
      });
      setFeedback({ type: 'success', text: res.data.message || 'Driver pickup scheduled.' });
      setSchedulePickupModalOpen(false);
      fetchShipments();
    } catch (err) {
      setFeedback({ type: 'danger', text: err.response?.data?.error || 'Failed to schedule driver pickup.' });
    } finally {
      setSubmittingSchedule(false);
    }
  };

  // Open Status Milestone Update
  const handleOpenMilestone = (shipment) => {
    setSelectedShipment(shipment);
    setTargetStatus('');
    setEventLocation(shipment.destination_city || 'Addis Ababa');
    setEventDescription('');
    setMilestoneModalOpen(true);
  };

  const handleSaveMilestone = async (e) => {
    e.preventDefault();
    if (!selectedShipment || !targetStatus) return;
    try {
      await api.post(`delivery/shipments/${selectedShipment.id}/status/`, {
        status: targetStatus,
        location: eventLocation,
        description: eventDescription,
      });
      setFeedback({ type: 'success', text: `Shipment moved to ${targetStatus}.` });
      setMilestoneModalOpen(false);
      fetchShipments();
    } catch (err) {
      setFeedback({ type: 'danger', text: err.response?.data?.error || 'Failed to advance status.' });
    }
  };

  // Open Local Driver Assignment
  const handleOpenLocalDriver = (shipment) => {
    setSelectedShipment(shipment);
    setLocalPersonnelId(shipment.delivery_personnel?.id || '');
    setLocalDriverNotes('');
    setLocalDriverModalOpen(true);
  };

  const handleSaveLocalDriver = async (e) => {
    e.preventDefault();
    if (!selectedShipment || !localPersonnelId) return;
    try {
      await api.post(`delivery/shipments/${selectedShipment.id}/assign-local/`, {
        delivery_personnel_id: Number(localPersonnelId),
        notes: localDriverNotes,
      });
      setFeedback({ type: 'success', text: 'Local delivery driver assigned successfully.' });
      setLocalDriverModalOpen(false);
      fetchShipments();
    } catch (err) {
      setFeedback({ type: 'danger', text: err.response?.data?.error || 'Failed to assign local driver.' });
    }
  };

  // Request OTP
  const handleRequestOtp = async (shipment) => {
    setSelectedShipment(shipment);
    setOtpLoading(true);
    try {
      const res = await api.post(`delivery/shipments/${shipment.id}/request-otp/`);
      setOtpSentInfo(res.data);
      setEnteredOtp('');
      setOtpModalOpen(true);
      setFeedback({ type: 'success', text: res.data.message });
    } catch (err) {
      setFeedback({ type: 'danger', text: err.response?.data?.error || 'Failed to generate delivery OTP.' });
    } finally {
      setOtpLoading(false);
    }
  };

  // Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!selectedShipment || !enteredOtp) return;
    try {
      setOtpLoading(true);
      const res = await api.post(`delivery/shipments/${selectedShipment.id}/verify-otp/`, {
        otp: enteredOtp.trim(),
      });
      setFeedback({ type: 'success', text: res.data.message });
      setOtpModalOpen(false);
      fetchShipments();
    } catch (err) {
      setFeedback({ type: 'danger', text: err.response?.data?.error || 'Invalid or expired OTP.' });
    } finally {
      setOtpLoading(false);
    }
  };

  // Record Failed Attempt
  const handleOpenAttempt = (shipment) => {
    setSelectedShipment(shipment);
    setAttemptReason('CUSTOMER_UNAVAILABLE');
    setAttemptNotes('');
    setNextAttemptDate('');
    setAttemptModalOpen(true);
  };

  const handleSaveAttempt = async (e) => {
    e.preventDefault();
    if (!selectedShipment) return;
    try {
      await api.post(`delivery/shipments/${selectedShipment.id}/record-attempt/`, {
        reason: attemptReason,
        notes: attemptNotes,
        next_scheduled_attempt: nextAttemptDate || null,
      });
      setFeedback({ type: 'warning', text: 'Failed delivery attempt logged and customer notified.' });
      setAttemptModalOpen(false);
      fetchShipments();
    } catch (err) {
      setFeedback({ type: 'danger', text: err.response?.data?.error || 'Failed to record attempt.' });
    }
  };

  // View Shipment Detail
  const handleViewDetail = async (shipmentId) => {
    try {
      setLoadingDetail(true);
      setDetailModalOpen(true);
      const res = await api.get(`delivery/shipments/${shipmentId}/`);
      setDetailShipment(res.data);
    } catch (err) {
      setFeedback({ type: 'danger', text: 'Failed to load shipment details.' });
      setDetailModalOpen(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <div className="container-fluid py-4 px-3 px-md-4">
      {/* Title */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <div className="d-flex align-items-center gap-2">
            <h1 className="h3 fw-bolder text-slate-900 mb-0">Order Manager Logistics Control</h1>
            <span className="badge bg-blue-600 text-white font-bold text-uppercase px-2.5 py-1 text-xs">
              EthioTech Logistics
            </span>
          </div>
          <p className="text-muted small mb-0 mt-1">
            Dispatch, track, assign regional couriers & local drivers, log milestones, and confirm customer handovers via secure OTP.
          </p>
        </div>

        <button
          className="btn btn-outline-primary btn-sm rounded-pill px-3 py-1.5 text-xs font-bold"
          onClick={() => {
            fetchShipments();
            fetchAuxData();
          }}
        >
          <i className="bi bi-arrow-clockwise me-1"></i> Refresh Shipments
        </button>
      </div>

      {/* Feedback Alert */}
      {feedback.text && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show rounded-3 py-2.5 px-3 text-sm mb-4`} role="alert">
          {feedback.text}
          <button type="button" className="btn-close py-2.5" onClick={() => setFeedback({ type: '', text: '' })} aria-label="Close"></button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="card border-0 shadow-sm rounded-4 p-3 mb-4 bg-white border border-slate-200">
        <div className="row g-2 align-items-center">
          <div className="col-12 col-md-5">
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-light text-muted"><i className="bi bi-search"></i></span>
              <input
                type="text"
                className="form-control"
                placeholder="Search tracking #, order #, recipient name, city..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="col-6 col-md-3">
            <select
              className="form-select form-select-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Milestone Statuses</option>
              <option value="CONFIRMED">1. Confirmed</option>
              <option value="READY_FOR_DISPATCH">2. Ready for Dispatch</option>
              <option value="BOOKING_REQUESTED">3. Booking Requested</option>
              <option value="BOOKING_CONFIRMED">4. Booking Confirmed</option>
              <option value="PICKUP_SCHEDULED">5. Pickup Scheduled</option>
              <option value="PICKED_UP">6. Package Picked Up</option>
              <option value="IN_TRANSIT">7. In Transit</option>
              <option value="ARRIVED_AT_SORTING_CENTER">Sorting Center</option>
              <option value="ARRIVED_AT_DESTINATION">Arrived at Destination</option>
              <option value="OUT_FOR_DELIVERY">8. Out for Delivery</option>
              <option value="DELIVERY_ATTEMPT_FAILED">Attempt Failed</option>
              <option value="DELIVERED">9. Delivered (OTP Verified)</option>
            </select>
          </div>
          <div className="col-6 col-md-4">
            <select
              className="form-select form-select-sm"
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
            >
              <option value="">All Delivery Methods</option>
              <option value="THIRD_PARTY_COURIER">Third-Party Courier (ABC Express, etc.)</option>
              <option value="OWN_DELIVERY">Own Fleet Delivery</option>
            </select>
          </div>
        </div>
      </div>

      {/* Shipments Table */}
      <div className="card border-0 shadow-sm rounded-4 overflow-hidden border border-slate-200">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0 text-sm">
            <thead className="table-light text-slate-600 text-xs text-uppercase">
              <tr>
                <th className="ps-4">Tracking Code & Order</th>
                <th>Destination & Recipient</th>
                <th>Courier / Driver Assignment</th>
                <th>Current Milestone</th>
                <th>Delivery Workflow Actions</th>
                <th className="text-end pe-4">Audit</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-5 text-muted">
                    <div className="spinner-border spinner-border-sm me-2"></div> Loading live shipments...
                  </td>
                </tr>
              ) : shipments.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-5 text-muted">
                    No active shipments found matching the filters.
                  </td>
                </tr>
              ) : (
                shipments.map((s) => (
                  <tr key={s.id}>
                    <td className="ps-4">
                      <div className="d-flex align-items-center gap-1.5">
                        <span className="fw-bolder font-mono text-primary">{s.tracking_number}</span>
                      </div>
                      <div className="text-muted text-xs">
                        Order #{s.order_number} &bull; {s.customer_username}
                      </div>
                      {s.booking_reference && (
                        <div className="mt-1">
                          <span className="badge bg-light text-slate-700 border font-mono text-xs">
                            <i className="bi bi-tag me-1 text-primary"></i>{s.booking_reference}
                          </span>
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="fw-bold text-slate-800">
                        <i className="bi bi-geo-alt-fill text-danger me-1"></i>{s.destination_city}
                      </div>
                      <div className="text-muted text-xs">{s.recipient_name} ({s.recipient_phone})</div>
                      <div className="text-slate-500 text-xs mt-0.5 text-truncate" style={{ maxWidth: '180px' }}>
                        {s.delivery_address}
                      </div>
                    </td>
                    <td>
                      <span className="badge bg-light text-slate-700 border text-xs">
                        {s.delivery_method_display}
                      </span>
                      {s.courier_name && (
                        <div className="fw-semibold text-slate-700 text-xs mt-1">
                          <i className="bi bi-box-seam me-1 text-primary"></i>{s.courier_name}
                          {s.external_tracking_number && (
                            <span className="text-muted font-mono ms-1">({s.external_tracking_number})</span>
                          )}
                        </div>
                      )}
                      {s.pickup_driver_name && (
                        <div className="text-muted text-xs mt-0.5">
                          <i className="bi bi-truck text-indigo me-1"></i>Pickup: {s.pickup_driver_name} ({s.pickup_vehicle_plate || 'Van'})
                        </div>
                      )}
                      {s.handover_confirmed_at && (
                        <div className="text-success text-xs mt-0.5">
                          <i className="bi bi-check-circle-fill me-1"></i>Dock Handover Confirmed
                        </div>
                      )}
                      {s.personnel_name && (
                        <div className="text-muted text-xs mt-0.5">
                          <i className="bi bi-person-fill text-success me-1"></i>Local Agent: {s.personnel_name}
                        </div>
                      )}
                    </td>
                    <td>
                      <span
                        className={`badge px-2.5 py-1 text-xs ${
                          s.status === 'DELIVERED'
                            ? 'bg-success text-white'
                            : s.status === 'OUT_FOR_DELIVERY'
                            ? 'bg-primary text-white'
                            : s.status === 'DELIVERY_ATTEMPT_FAILED'
                            ? 'bg-danger text-white'
                            : s.status === 'READY_FOR_DISPATCH'
                            ? 'bg-warning text-dark font-bold'
                            : s.status === 'BOOKING_REQUESTED'
                            ? 'bg-amber-500 text-white font-bold'
                            : s.status === 'BOOKING_CONFIRMED'
                            ? 'bg-indigo-600 text-white font-bold'
                            : s.status === 'PICKUP_SCHEDULED'
                            ? 'bg-purple-600 text-white font-bold'
                            : s.status === 'PICKED_UP'
                            ? 'bg-cyan-600 text-white font-bold'
                            : s.status === 'IN_TRANSIT'
                            ? 'bg-blue-600 text-white font-bold'
                            : 'bg-secondary text-white'
                        }`}
                        style={
                          s.status === 'BOOKING_REQUESTED'
                            ? { backgroundColor: '#f59e0b' }
                            : s.status === 'BOOKING_CONFIRMED'
                            ? { backgroundColor: '#4f46e5' }
                            : s.status === 'PICKUP_SCHEDULED'
                            ? { backgroundColor: '#7c3aed' }
                            : s.status === 'PICKED_UP'
                            ? { backgroundColor: '#0891b2' }
                            : undefined
                        }
                      >
                        {s.status_display}
                      </span>
                    </td>
                    <td>
                      <div className="d-flex flex-wrap gap-1.5 align-items-center">
                        {/* Stage 3: Book Courier */}
                        {s.status === 'READY_FOR_DISPATCH' && (
                          <button
                            className="btn btn-primary btn-sm rounded-pill px-2.5 py-0.5 text-xs font-semibold shadow-sm"
                            onClick={() => handleOpenBookCourier(s)}
                            title="Stage 3: Select courier and send booking request"
                          >
                            <i className="bi bi-envelope-plus me-1"></i> 3. Book Courier
                          </button>
                        )}

                        {/* Stage 4: Record Courier Confirmation / Rejection */}
                        {s.status === 'BOOKING_REQUESTED' && (
                          <button
                            className="btn btn-warning btn-sm rounded-pill px-2.5 py-0.5 text-xs font-semibold text-slate-900 shadow-sm"
                            onClick={() => handleOpenConfirmBooking(s)}
                            title="Stage 4: Record courier acceptance or rejection"
                          >
                            <i className="bi bi-check2-circle me-1"></i> 4. Courier Confirm
                          </button>
                        )}

                        {/* Stage 5: Schedule Driver Pickup */}
                        {s.status === 'BOOKING_CONFIRMED' && (
                          <button
                            className="btn btn-sm rounded-pill px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm"
                            style={{ backgroundColor: '#4f46e5' }}
                            onClick={() => handleOpenSchedulePickup(s)}
                            title="Stage 5: Record driver details and scheduled pickup"
                          >
                            <i className="bi bi-calendar-event me-1"></i> 5. Schedule Driver
                          </button>
                        )}

                        {/* Stage 6 Notice: Waiting for Store Manager Handover */}
                        {s.status === 'PICKUP_SCHEDULED' && (
                          <>
                            <span className="badge bg-info-subtle text-info border border-info-subtle text-xs py-1 px-2">
                              <i className="bi bi-clock me-1"></i> Awaiting Store Handover
                            </span>
                            <button
                              className="btn btn-outline-secondary btn-sm rounded-pill px-2 py-0.5 text-xs"
                              onClick={() => handleOpenSchedulePickup(s)}
                              title="Edit Driver Details"
                            >
                              <i className="bi bi-pencil"></i>
                            </button>
                          </>
                        )}

                        {/* Stage 7: Update Intercity Transit Milestone */}
                        {['PICKED_UP', 'IN_TRANSIT', 'ARRIVED_AT_SORTING_CENTER'].includes(s.status) && (
                          <button
                            className="btn btn-outline-primary btn-sm rounded-pill px-2.5 py-0.5 text-xs font-semibold"
                            onClick={() => handleOpenMilestone(s)}
                            title="Stage 7: Log transit milestones along Addis Ababa to destination corridor"
                          >
                            <i className="bi bi-arrow-right-circle me-1"></i> 7. Update Transit
                          </button>
                        )}

                        {/* Stage 8: Assign Local Delivery Driver */}
                        {['ARRIVED_AT_DESTINATION'].includes(s.status) && (
                          <button
                            className="btn btn-outline-info btn-sm rounded-pill px-2.5 py-0.5 text-xs font-semibold"
                            onClick={() => handleOpenLocalDriver(s)}
                            title="Stage 8: Assign local city driver for home delivery"
                          >
                            <i className="bi bi-person-plus me-1"></i> 8. Assign Local Driver
                          </button>
                        )}

                        {/* Stage 9: OTP Handover Verification */}
                        {['OUT_FOR_DELIVERY'].includes(s.status) && (
                          <>
                            <button
                              className="btn btn-success btn-sm rounded-pill px-2.5 py-0.5 text-xs font-bold shadow-sm"
                              onClick={() => handleRequestOtp(s)}
                              disabled={otpLoading}
                              title="Stage 9: Verify customer OTP and complete delivery"
                            >
                              <i className="bi bi-shield-check me-1"></i> 9. Verify OTP
                            </button>
                            <button
                              className="btn btn-outline-danger btn-sm rounded-pill px-2.5 py-0.5 text-xs font-semibold"
                              onClick={() => handleOpenAttempt(s)}
                              title="Record unsuccessful delivery attempt"
                            >
                              <i className="bi bi-x-circle me-1"></i> Failed
                            </button>
                          </>
                        )}

                        {/* Failed Attempt State Actions */}
                        {s.status === 'DELIVERY_ATTEMPT_FAILED' && (
                          <>
                            <button
                              className="btn btn-outline-info btn-sm rounded-pill px-2.5 py-0.5 text-xs font-semibold"
                              onClick={() => handleOpenLocalDriver(s)}
                              title="Re-schedule or change local delivery driver"
                            >
                              <i className="bi bi-arrow-repeat me-1"></i> Re-assign
                            </button>
                            <button
                              className="btn btn-success btn-sm rounded-pill px-2.5 py-0.5 text-xs font-bold shadow-sm"
                              onClick={() => handleRequestOtp(s)}
                              disabled={otpLoading}
                              title="Retry OTP verification"
                            >
                              <i className="bi bi-shield-check me-1"></i> Retry OTP
                            </button>
                          </>
                        )}

                        {/* Manual / Fleet override button for any active shipment */}
                        {s.status !== 'DELIVERED' && (
                          <button
                            className="btn btn-outline-secondary btn-sm rounded-pill px-2 py-0.5 text-xs"
                            onClick={() => handleOpenAssign(s)}
                            title="Carrier / Fleet Assignment Override"
                          >
                            <i className="bi bi-gear"></i>
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="text-end pe-4">
                      <button
                        className="btn btn-light btn-sm rounded-pill px-3 py-1 text-xs border"
                        onClick={() => handleViewDetail(s.id)}
                      >
                        <i className="bi bi-clock-history me-1"></i> Timeline
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============================================================== */}
      {/* MODAL: STAGE 3 - COURIER BOOKING REQUEST */}
      {/* ============================================================== */}
      {bookCourierModalOpen && selectedShipment && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 border-0 shadow">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold text-slate-900">
                  <i className="bi bi-envelope-plus text-primary me-2"></i> Stage 3: Courier Booking Request
                </h5>
                <button type="button" className="btn-close" onClick={() => setBookCourierModalOpen(false)}></button>
              </div>
              <form onSubmit={handleSaveBookCourier}>
                <div className="modal-body text-sm">
                  <div className="p-3 bg-light rounded-3 mb-3 border">
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-muted text-xs">Tracking Number:</span>
                      <span className="fw-bold font-mono text-primary">{selectedShipment.tracking_number}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-muted text-xs">Order Number:</span>
                      <span className="fw-bold text-slate-800">#{selectedShipment.order_number}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-muted text-xs">Corridor:</span>
                      <span className="fw-bold text-slate-800">{selectedShipment.origin_city} &rarr; {selectedShipment.destination_city}</span>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span className="text-muted text-xs">Recipient:</span>
                      <span className="text-slate-800">{selectedShipment.recipient_name} ({selectedShipment.recipient_phone})</span>
                    </div>
                  </div>

                  <div className="alert alert-info py-2 px-3 text-xs mb-3 rounded-3">
                    <i className="bi bi-info-circle me-1"></i> Submitting this request sends an official Courier Booking Request email to the selected courier partner with pickup details, cargo weight, dimensions, and fulfillment center address.
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Select Courier Company Partner *</label>
                    <select
                      className="form-select"
                      required
                      value={bookCourierId}
                      onChange={(e) => setBookCourierId(e.target.value)}
                    >
                      <option value="">Choose courier partner...</option>
                      {couriers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.origin_city} &rarr; Hubs) &bull; {c.email}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label fw-semibold">Requested Pickup Date *</label>
                      <input
                        type="datetime-local"
                        className="form-control"
                        required
                        value={bookPickupDate}
                        onChange={(e) => setBookPickupDate(e.target.value)}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label fw-semibold">Package Weight (kg) *</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        className="form-control"
                        required
                        value={bookWeight}
                        onChange={(e) => setBookWeight(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Package Dimensions (L x W x H)</label>
                    <input
                      type="text"
                      className="form-control"
                      value={bookDimensions}
                      onChange={(e) => setBookDimensions(e.target.value)}
                      placeholder="e.g. 30x20x15 cm"
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Booking Instructions / Cargo Notes</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      value={bookNotes}
                      onChange={(e) => setBookNotes(e.target.value)}
                      placeholder="Special handling instructions, gate instructions, packaging description..."
                    />
                  </div>
                </div>
                <div className="modal-footer border-0 pt-0">
                  <button type="button" className="btn btn-light rounded-pill px-4 text-xs font-bold" onClick={() => setBookCourierModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary rounded-pill px-4 text-xs font-bold" disabled={submittingBooking}>
                    {submittingBooking ? (
                      <span><span className="spinner-border spinner-border-sm me-1"></span>Sending Request...</span>
                    ) : (
                      <span><i className="bi bi-send me-1"></i> Send Booking Request</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: STAGE 4 - RECORD COURIER CONFIRMATION / REJECTION */}
      {/* ============================================================== */}
      {confirmBookingModalOpen && selectedShipment && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 border-0 shadow">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold text-slate-900">
                  <i className="bi bi-check2-circle text-warning me-2"></i> Stage 4: Courier Booking Response
                </h5>
                <button type="button" className="btn-close" onClick={() => setConfirmBookingModalOpen(false)}></button>
              </div>
              <form onSubmit={handleSaveConfirmBooking}>
                <div className="modal-body text-sm">
                  <div className="p-3 bg-light rounded-3 mb-3 border">
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-muted text-xs">Tracking Number:</span>
                      <span className="fw-bold font-mono text-primary">{selectedShipment.tracking_number}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-muted text-xs">Booking Reference:</span>
                      <span className="fw-bold font-mono text-slate-900">{selectedShipment.booking_reference || 'N/A'}</span>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span className="text-muted text-xs">Courier Partner:</span>
                      <span className="fw-bold text-slate-800">{selectedShipment.courier_name || 'Selected Courier'}</span>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Courier Decision *</label>
                    <div className="d-flex gap-3">
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          id="decisionConfirm"
                          name="courierDecision"
                          checked={confirmBookingAction === 'CONFIRM'}
                          onChange={() => setConfirmBookingAction('CONFIRM')}
                        />
                        <label className="form-check-label fw-bold text-success" htmlFor="decisionConfirm">
                          <i className="bi bi-check-circle me-1"></i> Accept & Confirm Booking
                        </label>
                      </div>
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          id="decisionReject"
                          name="courierDecision"
                          checked={confirmBookingAction === 'REJECT'}
                          onChange={() => setConfirmBookingAction('REJECT')}
                        />
                        <label className="form-check-label fw-bold text-danger" htmlFor="decisionReject">
                          <i className="bi bi-x-circle me-1"></i> Reject Booking Request
                        </label>
                      </div>
                    </div>
                  </div>

                  {confirmBookingAction === 'CONFIRM' ? (
                    <>
                      <div className="mb-3">
                        <label className="form-label fw-semibold">External Courier Waybill / Tracking # *</label>
                        <input
                          type="text"
                          className="form-control font-mono"
                          required
                          value={confirmWaybill}
                          onChange={(e) => setConfirmWaybill(e.target.value)}
                          placeholder="e.g. ABC-ET-BD-90812"
                        />
                      </div>
                      <div className="row g-2 mb-3">
                        <div className="col-6">
                          <label className="form-label fw-semibold">Pickup Driver Name</label>
                          <input
                            type="text"
                            className="form-control"
                            value={confirmDriverName}
                            onChange={(e) => setConfirmDriverName(e.target.value)}
                            placeholder="e.g. Abebe Bikila"
                          />
                        </div>
                        <div className="col-6">
                          <label className="form-label fw-semibold">Driver Phone</label>
                          <input
                            type="text"
                            className="form-control"
                            value={confirmDriverPhone}
                            onChange={(e) => setConfirmDriverPhone(e.target.value)}
                            placeholder="+251911223344"
                          />
                        </div>
                      </div>
                      <div className="row g-2 mb-3">
                        <div className="col-6">
                          <label className="form-label fw-semibold">Vehicle Plate Number</label>
                          <input
                            type="text"
                            className="form-control font-mono"
                            value={confirmVehiclePlate}
                            onChange={(e) => setConfirmVehiclePlate(e.target.value)}
                            placeholder="AA-3-98765"
                          />
                        </div>
                        <div className="col-6">
                          <label className="form-label fw-semibold">Scheduled Pickup Time</label>
                          <input
                            type="datetime-local"
                            className="form-control"
                            value={confirmPickupScheduledAt}
                            onChange={(e) => setConfirmPickupScheduledAt(e.target.value)}
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="mb-3">
                      <label className="form-label fw-semibold text-danger">Rejection Reason *</label>
                      <textarea
                        className="form-control border-danger"
                        rows="2"
                        required
                        value={confirmRejectionReason}
                        onChange={(e) => setConfirmRejectionReason(e.target.value)}
                        placeholder="State courier reason (e.g. No regional capacity, road disruption, weight limit)..."
                      />
                    </div>
                  )}

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Confirmation Notes</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      value={confirmNotes}
                      onChange={(e) => setConfirmNotes(e.target.value)}
                      placeholder="e.g. Confirmed with ABC Express central dispatch phone/portal."
                    />
                  </div>
                </div>
                <div className="modal-footer border-0 pt-0">
                  <button type="button" className="btn btn-light rounded-pill px-4 text-xs font-bold" onClick={() => setConfirmBookingModalOpen(false)}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`btn rounded-pill px-4 text-xs font-bold ${confirmBookingAction === 'CONFIRM' ? 'btn-success' : 'btn-danger'}`}
                    disabled={submittingConfirm}
                  >
                    {submittingConfirm ? 'Saving...' : confirmBookingAction === 'CONFIRM' ? 'Record Confirmation' : 'Record Rejection'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: STAGE 5 - DRIVER PICKUP SCHEDULING */}
      {/* ============================================================== */}
      {schedulePickupModalOpen && selectedShipment && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 border-0 shadow">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold text-slate-900">
                  <i className="bi bi-calendar-event text-primary me-2"></i> Stage 5: Schedule Driver Pickup
                </h5>
                <button type="button" className="btn-close" onClick={() => setSchedulePickupModalOpen(false)}></button>
              </div>
              <form onSubmit={handleSaveSchedulePickup}>
                <div className="modal-body text-sm">
                  <div className="p-3 bg-light rounded-3 mb-3 border">
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-muted text-xs">Tracking Number:</span>
                      <span className="fw-bold font-mono text-primary">{selectedShipment.tracking_number}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-muted text-xs">Courier:</span>
                      <span className="fw-bold text-slate-800">{selectedShipment.courier_name}</span>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span className="text-muted text-xs">Destination:</span>
                      <span className="text-slate-800">{selectedShipment.destination_city}</span>
                    </div>
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label fw-semibold">Pickup Driver Name *</label>
                      <input
                        type="text"
                        className="form-control"
                        required
                        value={schedDriverName}
                        onChange={(e) => setSchedDriverName(e.target.value)}
                        placeholder="e.g. Abebe Bikila"
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label fw-semibold">Driver Phone Number *</label>
                      <input
                        type="text"
                        className="form-control"
                        required
                        value={schedDriverPhone}
                        onChange={(e) => setSchedDriverPhone(e.target.value)}
                        placeholder="+251911223344"
                      />
                    </div>
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label fw-semibold">Vehicle Plate Number *</label>
                      <input
                        type="text"
                        className="form-control font-mono"
                        required
                        value={schedVehiclePlate}
                        onChange={(e) => setSchedVehiclePlate(e.target.value)}
                        placeholder="AA-3-98765"
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label fw-semibold">Scheduled Pickup Time *</label>
                      <input
                        type="datetime-local"
                        className="form-control"
                        required
                        value={schedPickupAt}
                        onChange={(e) => setSchedPickupAt(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Driver Instructions</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      value={schedNotes}
                      onChange={(e) => setSchedNotes(e.target.value)}
                      placeholder="e.g. Report to Bay 3 with order confirmation badge."
                    />
                  </div>
                </div>
                <div className="modal-footer border-0 pt-0">
                  <button type="button" className="btn btn-light rounded-pill px-4 text-xs font-bold" onClick={() => setSchedulePickupModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary rounded-pill px-4 text-xs font-bold" disabled={submittingSchedule}>
                    {submittingSchedule ? 'Saving...' : 'Confirm Driver Schedule'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: ASSIGN COURIER / OWN FLEET */}
      {/* ============================================================== */}
      {assignModalOpen && selectedShipment && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 border-0 shadow">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold text-slate-900">
                  <i className="bi bi-box-seam text-primary me-2"></i> Assign Carrier & Dispatch
                </h5>
                <button type="button" className="btn-close" onClick={() => setAssignModalOpen(false)}></button>
              </div>
              <form onSubmit={handleSaveAssignment}>
                <div className="modal-body text-sm">
                  <div className="p-3 bg-light rounded-3 mb-3 border">
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-muted text-xs">Tracking Number:</span>
                      <span className="fw-bold font-mono text-primary">{selectedShipment.tracking_number}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-muted text-xs">Destination City:</span>
                      <span className="fw-bold text-slate-800">{selectedShipment.destination_city}</span>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span className="text-muted text-xs">Recipient:</span>
                      <span className="text-slate-800">{selectedShipment.recipient_name} ({selectedShipment.recipient_phone})</span>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Delivery Method *</label>
                    <select
                      className="form-select"
                      value={assignMethod}
                      onChange={(e) => setAssignMethod(e.target.value)}
                    >
                      <option value="THIRD_PARTY_COURIER">Method A: Third-Party Courier (ABC Express, etc.)</option>
                      <option value="OWN_DELIVERY">Method B: Own Delivery Service (Company Fleet)</option>
                    </select>
                  </div>

                  {assignMethod === 'THIRD_PARTY_COURIER' ? (
                    <>
                      <div className="mb-3">
                        <label className="form-label fw-semibold">Select Courier Company Partner *</label>
                        <select
                          className="form-select"
                          required
                          value={assignCourierId}
                          onChange={(e) => setAssignCourierId(e.target.value)}
                        >
                          <option value="">Choose courier partner...</option>
                          {couriers.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.origin_city} &rarr; Hubs)
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="mb-3">
                        <label className="form-label fw-semibold">External Courier Waybill / Tracking #</label>
                        <input
                          type="text"
                          className="form-control font-mono"
                          value={assignExtTracking}
                          onChange={(e) => setAssignExtTracking(e.target.value)}
                          placeholder="e.g. ABC-ET-BD-88412"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mb-3">
                        <label className="form-label fw-semibold">Select Company Delivery Vehicle *</label>
                        <select
                          className="form-select"
                          required
                          value={assignVehicleId}
                          onChange={(e) => setAssignVehicleId(e.target.value)}
                        >
                          <option value="">Choose company vehicle...</option>
                          {vehicles.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.registration_number} &ndash; {v.model} ({v.current_city} - {v.status_display})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="mb-3">
                        <label className="form-label fw-semibold">Assigned Company Driver *</label>
                        <select
                          className="form-select"
                          required
                          value={assignPersonnelId}
                          onChange={(e) => setAssignPersonnelId(e.target.value)}
                        >
                          <option value="">Choose delivery personnel...</option>
                          {personnel.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.full_name} ({p.current_city} &bull; {p.employee_code})
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Dispatch Notes</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      value={assignNotes}
                      onChange={(e) => setAssignNotes(e.target.value)}
                      placeholder="e.g. Package collected at Addis Ababa central fulfillment center dock."
                    />
                  </div>
                </div>
                <div className="modal-footer border-0 pt-0">
                  <button type="button" className="btn btn-light rounded-pill px-4 text-xs font-bold" onClick={() => setAssignModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary rounded-pill px-4 text-xs font-bold">
                    Confirm Assignment
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: UPDATE MILESTONE STATUS */}
      {/* ============================================================== */}
      {milestoneModalOpen && selectedShipment && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 border-0 shadow">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold text-slate-900">
                  <i className="bi bi-geo-alt-fill text-primary me-2"></i> Update Shipment Milestone
                </h5>
                <button type="button" className="btn-close" onClick={() => setMilestoneModalOpen(false)}></button>
              </div>
              <form onSubmit={handleSaveMilestone}>
                <div className="modal-body text-sm">
                  <div className="p-3 bg-light rounded-3 mb-3 border">
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-muted text-xs">Tracking Number:</span>
                      <span className="font-mono fw-bold text-primary">{selectedShipment.tracking_number}</span>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span className="text-muted text-xs">Current Milestone:</span>
                      <span className="badge bg-secondary-subtle text-secondary px-2 py-0.5">{selectedShipment.status_display}</span>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Target Next Milestone *</label>
                    <select
                      className="form-select"
                      required
                      value={targetStatus}
                      onChange={(e) => setTargetStatus(e.target.value)}
                    >
                      <option value="">Select status milestone...</option>
                      <option value="PICKED_UP">PICKED_UP (Courier Collected from Shop)</option>
                      <option value="IN_TRANSIT">IN_TRANSIT (On Intercity Transport)</option>
                      <option value="ARRIVED_AT_SORTING_CENTER">ARRIVED_AT_SORTING_CENTER (Regional Sorting Hub)</option>
                      <option value="ARRIVED_AT_DESTINATION">ARRIVED_AT_DESTINATION (Reached Destination Branch/Station)</option>
                      <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY (Local Driver Out to Customer)</option>
                      <option value="DELAYED">DELAYED (Weather, Road, Transit Delay)</option>
                    </select>
                    <div className="form-text text-xs text-muted">
                      Note: Final DELIVERED status requires physical customer verification via OTP.
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Event Location *</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      value={eventLocation}
                      onChange={(e) => setEventLocation(e.target.value)}
                      placeholder="e.g. Debre Markos Transit Corridor or Bahir Dar Hub"
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Event Description</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      value={eventDescription}
                      onChange={(e) => setEventDescription(e.target.value)}
                      placeholder="e.g. Package arrived at Bahir Dar courier branch. Sorted into delivery zone."
                    />
                  </div>
                </div>
                <div className="modal-footer border-0 pt-0">
                  <button type="button" className="btn btn-light rounded-pill px-4 text-xs font-bold" onClick={() => setMilestoneModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary rounded-pill px-4 text-xs font-bold">
                    Log Milestone Event
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: ASSIGN LOCAL DELIVERY DRIVER */}
      {/* ============================================================== */}
      {localDriverModalOpen && selectedShipment && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 border-0 shadow">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold text-slate-900">
                  <i className="bi bi-person-badge text-info me-2"></i> Assign Local City Handover Agent
                </h5>
                <button type="button" className="btn-close" onClick={() => setLocalDriverModalOpen(false)}></button>
              </div>
              <form onSubmit={handleSaveLocalDriver}>
                <div className="modal-body text-sm">
                  <p className="text-muted text-xs">
                    Assign a local driver or courier partner agent located in <strong>{selectedShipment.destination_city}</strong> to bring the parcel directly to customer's address.
                  </p>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Select Local Agent *</label>
                    <select
                      className="form-select"
                      required
                      value={localPersonnelId}
                      onChange={(e) => setLocalPersonnelId(e.target.value)}
                    >
                      <option value="">Choose local delivery agent...</option>
                      {personnel.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.full_name} &bull; {p.current_city} &bull; Tel: {p.phone_number}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Handover / Delivery Instructions</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      value={localDriverNotes}
                      onChange={(e) => setLocalDriverNotes(e.target.value)}
                      placeholder="e.g. Call customer before arrival. Verify OTP upon physical handover."
                    />
                  </div>
                </div>
                <div className="modal-footer border-0 pt-0">
                  <button type="button" className="btn btn-light rounded-pill px-4 text-xs font-bold" onClick={() => setLocalDriverModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary rounded-pill px-4 text-xs font-bold">
                    Assign Local Driver
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 4: OTP HANDOVER VERIFICATION */}
      {/* ============================================================== */}
      {otpModalOpen && selectedShipment && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 border-0 shadow">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold text-slate-900">
                  <i className="bi bi-shield-lock-fill text-success me-2"></i> Customer Handover OTP Verification
                </h5>
                <button type="button" className="btn-close" onClick={() => setOtpModalOpen(false)}></button>
              </div>
              <form onSubmit={handleVerifyOtp}>
                <div className="modal-body text-sm text-center">
                  <div className="my-2">
                    <div className="badge bg-success-subtle text-success px-3 py-1.5 text-xs rounded-pill mb-2">
                      <i className="bi bi-envelope-check me-1"></i> OTP Sent to Customer ({otpSentInfo?.recipient_email_masked || 'Email'})
                    </div>
                    <p className="text-muted text-xs">
                      The customer must physically inspect the delivered product. Ask the customer to provide their secure 6-digit OTP to complete delivery verification.
                    </p>
                  </div>

                  <div className="my-4">
                    <label className="form-label fw-bold text-slate-800 text-xs text-uppercase letter-spacing-1">
                      Enter Customer 6-Digit OTP
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      className="form-control form-control-lg text-center font-mono fw-bolder letter-spacing-4 py-2.5 rounded-3 border-2"
                      style={{ fontSize: '1.75rem', letterSpacing: '8px' }}
                      required
                      placeholder="000000"
                      value={enteredOtp}
                      onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, ''))}
                    />
                    <div className="form-text text-xs text-muted mt-2">
                      Expires in 5 minutes &bull; Max 3 attempts
                    </div>
                  </div>

                  <div className="d-flex justify-content-center gap-2">
                    <button
                      type="button"
                      className="btn btn-link text-primary text-xs text-decoration-none"
                      onClick={() => handleRequestOtp(selectedShipment)}
                      disabled={otpLoading}
                    >
                      <i className="bi bi-arrow-repeat me-1"></i> Resend OTP to Customer
                    </button>
                  </div>
                </div>
                <div className="modal-footer border-0 pt-0">
                  <button type="button" className="btn btn-light rounded-pill px-4 text-xs font-bold" onClick={() => setOtpModalOpen(false)}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-success rounded-pill px-5 text-xs font-bold shadow-sm"
                    disabled={otpLoading || enteredOtp.length < 6}
                  >
                    {otpLoading ? 'Verifying...' : 'Confirm Delivery'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 5: LOG FAILED DELIVERY ATTEMPT */}
      {/* ============================================================== */}
      {attemptModalOpen && selectedShipment && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 border-0 shadow">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold text-danger">
                  <i className="bi bi-exclamation-triangle-fill text-danger me-2"></i> Record Failed Delivery Attempt
                </h5>
                <button type="button" className="btn-close" onClick={() => setAttemptModalOpen(false)}></button>
              </div>
              <form onSubmit={handleSaveAttempt}>
                <div className="modal-body text-sm">
                  <p className="text-muted text-xs">
                    Log this attempt if the customer is unreachable, unavailable, or rejected the parcel. The status will transition to <strong>DELIVERY_ATTEMPT_FAILED</strong>.
                  </p>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Failure Reason *</label>
                    <select
                      className="form-select"
                      required
                      value={attemptReason}
                      onChange={(e) => setAttemptReason(e.target.value)}
                    >
                      <option value="CUSTOMER_UNAVAILABLE">Customer Unavailable at Address</option>
                      <option value="PHONE_UNREACHABLE">Customer Phone Unreachable / Switched Off</option>
                      <option value="INCORRECT_ADDRESS">Incorrect / Unlocatable Address</option>
                      <option value="CUSTOMER_REJECTED">Customer Rejected Package</option>
                      <option value="PACKAGE_DAMAGED">Package Damaged During Transit</option>
                      <option value="COURIER_DELAY">Courier Transportation Delay</option>
                      <option value="OTHER">Other Delivery Problem</option>
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Next Scheduled Attempt Date (Optional)</label>
                    <input
                      type="date"
                      className="form-control"
                      value={nextAttemptDate}
                      onChange={(e) => setNextAttemptDate(e.target.value)}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Driver Notes & Description</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={attemptNotes}
                      onChange={(e) => setAttemptNotes(e.target.value)}
                      placeholder="e.g. Arrived at gate 14:30. Called recipient 3 times with no answer."
                    />
                  </div>
                </div>
                <div className="modal-footer border-0 pt-0">
                  <button type="button" className="btn btn-light rounded-pill px-4 text-xs font-bold" onClick={() => setAttemptModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-danger rounded-pill px-4 text-xs font-bold">
                    Record Failed Attempt
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 6: SHIPMENT TIMELINE & AUDIT DETAIL */}
      {/* ============================================================== */}
      {detailModalOpen && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content rounded-4 border-0 shadow">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold text-slate-900">
                  <i className="bi bi-clock-history text-primary me-2"></i> Shipment Logistics Audit
                </h5>
                <button type="button" className="btn-close" onClick={() => setDetailModalOpen(false)}></button>
              </div>
              <div className="modal-body text-sm">
                {loadingDetail || !detailShipment ? (
                  <div className="text-center py-5">
                    <div className="spinner-border spinner-border-sm me-2"></div> Loading complete tracking audit...
                  </div>
                ) : (
                  <div>
                    {/* Header Summary */}
                    <div className="p-3 bg-light rounded-3 mb-3 border">
                      <div className="row g-2">
                        <div className="col-6 col-md-3">
                          <span className="text-muted text-xs d-block">Tracking Number:</span>
                          <span className="fw-bold font-mono text-primary">{detailShipment.tracking_number}</span>
                        </div>
                        <div className="col-6 col-md-3">
                          <span className="text-muted text-xs d-block">Order Reference:</span>
                          <span className="fw-bold text-slate-800">#{detailShipment.order_number}</span>
                        </div>
                        <div className="col-6 col-md-3">
                          <span className="text-muted text-xs d-block">Current Status:</span>
                          <span className="badge bg-primary text-white">{detailShipment.status_display}</span>
                        </div>
                        <div className="col-6 col-md-3">
                          <span className="text-muted text-xs d-block">Corridor:</span>
                          <span className="fw-semibold text-slate-800">{detailShipment.origin_city} &rarr; {detailShipment.destination_city}</span>
                        </div>
                      </div>
                    </div>

                    {/* Stage Details Cards */}
                    <div className="row g-2 mb-4">
                      {/* Booking Card */}
                      <div className="col-12 col-md-6">
                        <div className="p-3 rounded-3 border bg-white h-100">
                          <div className="fw-bold text-slate-900 text-xs mb-2">
                            <i className="bi bi-envelope-paper text-primary me-1"></i> Courier Booking Audit
                          </div>
                          <div className="text-xs mb-1">
                            <span className="text-muted">Booking Reference: </span>
                            <span className="font-mono fw-bold text-primary">{detailShipment.booking_reference || 'N/A'}</span>
                          </div>
                          <div className="text-xs mb-1">
                            <span className="text-muted">Courier: </span>
                            <span className="fw-semibold">{detailShipment.courier_company?.name || detailShipment.courier_name || 'N/A'}</span>
                          </div>
                          <div className="text-xs mb-1">
                            <span className="text-muted">Waybill / External #: </span>
                            <span className="font-mono">{detailShipment.external_tracking_number || 'N/A'}</span>
                          </div>
                          <div className="text-xs">
                            <span className="text-muted">Cargo: </span>
                            <span>{detailShipment.total_weight_kg || 2.5} kg &bull; {detailShipment.package_dimensions || 'Standard'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Driver & Handover Card */}
                      <div className="col-12 col-md-6">
                        <div className="p-3 rounded-3 border bg-white h-100">
                          <div className="fw-bold text-slate-900 text-xs mb-2">
                            <i className="bi bi-truck text-indigo me-1"></i> Driver Pickup & Handover
                          </div>
                          <div className="text-xs mb-1">
                            <span className="text-muted">Driver: </span>
                            <span className="fw-semibold">{detailShipment.pickup_driver_name || 'Pending assignment'}</span>
                            {detailShipment.pickup_driver_phone && <span className="text-muted ms-1">({detailShipment.pickup_driver_phone})</span>}
                          </div>
                          <div className="text-xs mb-1">
                            <span className="text-muted">Vehicle Plate: </span>
                            <span className="font-mono">{detailShipment.pickup_vehicle_plate || 'N/A'}</span>
                          </div>
                          <div className="text-xs mb-1">
                            <span className="text-muted">Store Handover: </span>
                            {detailShipment.handover_confirmed_at ? (
                              <span className="badge bg-success-subtle text-success">
                                Confirmed {new Date(detailShipment.handover_confirmed_at).toLocaleString()}
                              </span>
                            ) : (
                              <span className="badge bg-secondary-subtle text-muted">Awaiting Handover</span>
                            )}
                          </div>
                          <div className="text-xs">
                            <span className="text-muted">Local Agent: </span>
                            <span>{detailShipment.delivery_personnel?.full_name || detailShipment.personnel_name || 'Not yet assigned'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Timeline */}
                    <h6 className="fw-bold text-slate-900 mb-3">
                      <i className="bi bi-geo-alt text-primary me-1"></i> Detailed Milestone Event History
                    </h6>
                    <div className="ps-3 border-start border-2 border-primary ms-2 mb-4">
                      {(detailShipment.events || []).length === 0 ? (
                        <p className="text-muted text-xs">No tracking events recorded yet.</p>
                      ) : (
                        detailShipment.events.map((ev, idx) => (
                          <div key={idx} className="position-relative mb-3 ps-3">
                            <span
                              className="position-absolute top-0 start-0 translate-middle p-1.5 bg-primary border border-white rounded-circle"
                              style={{ left: '-1px' }}
                            ></span>
                            <div className="d-flex justify-content-between align-items-center">
                              <span className="fw-bold text-slate-800 text-xs">{ev.status_display}</span>
                              <span className="text-muted text-xs font-mono">
                                {new Date(ev.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <div className="text-muted text-xs"><i className="bi bi-pin-map me-1 text-primary"></i>{ev.location}</div>
                            <div className="text-slate-700 text-xs mt-0.5">{ev.description}</div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Failed Attempts If Any */}
                    {(detailShipment.attempts || []).length > 0 && (
                      <div className="mb-4">
                        <h6 className="fw-bold text-danger mb-2">
                          <i className="bi bi-exclamation-octagon text-danger me-1"></i> Recorded Failed Attempts ({detailShipment.attempts.length})
                        </h6>
                        <div className="list-group">
                          {detailShipment.attempts.map((att, i) => (
                            <div key={i} className="list-group-item list-group-item-danger text-xs">
                              <div className="d-flex justify-content-between">
                                <strong>Attempt #{att.attempt_number}: {att.reason_display}</strong>
                                <span className="font-mono">{new Date(att.attempted_at).toLocaleString()}</span>
                              </div>
                              <div className="mt-1">{att.notes}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="modal-footer border-0 pt-0">
                <button type="button" className="btn btn-secondary btn-sm rounded-pill px-4" onClick={() => setDetailModalOpen(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderManagerShipmentsPage;
