import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { formatETB } from '../../utils/currency';

const LiveShipmentsPage = () => {
  // Main Data States
  const [shipments, setShipments] = useState([]);
  const [stats, setStats] = useState({
    total_active: 0,
    prepared: 0,
    assigned: 0,
    picked_up: 0,
    in_transit: 0,
    delivered: 0,
    failed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [lastUpdatedTime, setLastUpdatedTime] = useState(new Date());

  // Search & Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Auxiliary data for assignment
  const [eligibleOrders, setEligibleOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [personnelList, setPersonnelList] = useState([]);
  const [couriersList, setCouriersList] = useState([]);

  // Assignment Modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [assignMethod, setAssignMethod] = useState('OWN_DELIVERY');
  const [assignPersonnelId, setAssignPersonnelId] = useState('');
  const [assignCourierId, setAssignCourierId] = useState('');
  const [assignDeliveryAddress, setAssignDeliveryAddress] = useState('');
  const [assignExpectedDate, setAssignExpectedDate] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [submittingAssign, setSubmittingAssign] = useState(false);

  // Details Modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailShipment, setDetailShipment] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Status Update Modal
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [targetStatus, setTargetStatus] = useState('');
  const [statusLocation, setStatusLocation] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [submittingStatus, setSubmittingStatus] = useState(false);

  // Polling interval ref
  const pollingRef = useRef(null);

  // Fetch Stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('delivery/live-stats/');
      setStats(res.data);
    } catch (err) {
      console.error('Failed to load live shipment stats:', err);
    }
  }, []);

  // Fetch Shipments
  const fetchShipments = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      let url = `delivery/shipments/?search=${encodeURIComponent(search)}`;
      if (statusFilter) url += `&status=${encodeURIComponent(statusFilter)}`;

      const [shipmentsRes] = await Promise.all([
        api.get(url),
        fetchStats(),
      ]);

      setShipments(shipmentsRes.data.results || shipmentsRes.data || []);
      setLastUpdatedTime(new Date());
    } catch (err) {
      console.error('Failed to fetch shipments:', err);
      if (!isSilent) {
        setFeedback({ type: 'danger', text: 'Failed to load live shipments.' });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, statusFilter, fetchStats]);

  // Fetch Auxiliary Assignment Data
  const fetchAssignmentData = useCallback(async () => {
    try {
      setLoadingOrders(true);
      const [ordRes, pRes, cRes] = await Promise.all([
        api.get('delivery/eligible-orders/'),
        api.get('delivery/personnel/?available=true'),
        api.get('delivery/couriers/?active_only=true'),
      ]);
      setEligibleOrders(ordRes.data || []);
      setPersonnelList(pRes.data.results || pRes.data || []);
      setCouriersList(cRes.data.results || cRes.data || []);
    } catch (err) {
      console.error('Failed to load assignment data:', err);
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchShipments();
    fetchAssignmentData();
  }, [fetchShipments, fetchAssignmentData]);

  // Periodic Auto-Refresh Polling (Every 12 Seconds)
  useEffect(() => {
    if (autoRefreshEnabled) {
      pollingRef.current = setInterval(() => {
        fetchShipments(true);
      }, 12000);
    } else if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [autoRefreshEnabled, fetchShipments]);

  // Handle Order Selection in Assignment Modal
  const handleOrderChange = (e) => {
    const orderId = e.target.value;
    setSelectedOrderId(orderId);
    const ord = eligibleOrders.find((o) => String(o.id) === String(orderId));
    if (ord) {
      setAssignDeliveryAddress(ord.shipping_address || '');
      // Default expected delivery date: tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setAssignExpectedDate(tomorrow.toISOString().split('T')[0]);
    }
  };

  // Submit Assignment
  const handleSaveAssignment = async (e) => {
    e.preventDefault();
    if (!selectedOrderId) {
      alert('Please select an order to assign.');
      return;
    }
    if (assignMethod === 'OWN_DELIVERY' && !assignPersonnelId) {
      alert('Please select a delivery personnel / driver.');
      return;
    }
    if (assignMethod === 'THIRD_PARTY_COURIER' && !assignCourierId) {
      alert('Please select a courier company.');
      return;
    }

    try {
      setSubmittingAssign(true);
      const payload = {
        delivery_method: assignMethod,
        delivery_personnel_id: assignMethod === 'OWN_DELIVERY' ? Number(assignPersonnelId) : null,
        courier_company_id: assignMethod === 'THIRD_PARTY_COURIER' ? Number(assignCourierId) : null,
        delivery_address: assignDeliveryAddress,
        expected_delivery_date: assignExpectedDate || null,
        notes: assignNotes,
      };

      const res = await api.post(`delivery/orders/${selectedOrderId}/assign/`, payload);
      setFeedback({
        type: 'success',
        text: res.data?.message || 'Order successfully assigned for delivery!',
      });
      setAssignModalOpen(false);
      // Reset form
      setSelectedOrderId('');
      setAssignPersonnelId('');
      setAssignCourierId('');
      setAssignDeliveryAddress('');
      setAssignExpectedDate('');
      setAssignNotes('');

      fetchShipments(true);
      fetchAssignmentData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to assign order.');
    } finally {
      setSubmittingAssign(false);
    }
  };

  // Open Shipment Details
  const handleOpenDetail = async (shipment) => {
    try {
      setLoadingDetail(true);
      setDetailModalOpen(true);
      const res = await api.get(`delivery/shipments/${shipment.id}/`);
      setDetailShipment(res.data);
    } catch (err) {
      console.error('Failed to load shipment details:', err);
      setDetailShipment(shipment);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Open Status Modal
  const handleOpenStatusModal = (shipment) => {
    setSelectedShipment(shipment);
    setTargetStatus(shipment.status);
    setStatusLocation(shipment.destination_city || 'Addis Ababa');
    setStatusNote('');
    setStatusModalOpen(true);
  };

  // Submit Status Change
  const handleSaveStatus = async (e) => {
    e.preventDefault();
    if (!selectedShipment || !targetStatus) return;

    if (targetStatus === 'DELIVERED') {
      alert('Direct status change to DELIVERED requires customer delivery confirmation or driver handover verification.');
      return;
    }

    try {
      setSubmittingStatus(true);
      await api.post(`delivery/shipments/${selectedShipment.id}/status/`, {
        status: targetStatus,
        location: statusLocation,
        description: statusNote || `Status updated to ${targetStatus}`,
      });
      setFeedback({
        type: 'success',
        text: `Shipment ${selectedShipment.tracking_number} updated to ${targetStatus}.`,
      });
      setStatusModalOpen(false);
      fetchShipments(true);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update status.');
    } finally {
      setSubmittingStatus(false);
    }
  };

  // Badge Helper
  const getStatusBadge = (status) => {
    switch (status) {
      case 'PREPARED':
      case 'READY_FOR_DISPATCH':
        return <span className="badge bg-secondary text-white px-2.5 py-1">Prepared</span>;
      case 'ASSIGNED':
      case 'COURIER_ASSIGNED':
        return <span className="badge bg-primary text-white px-2.5 py-1">Assigned</span>;
      case 'PICKED_UP':
      case 'PICKUP_SCHEDULED':
        return <span className="badge bg-info text-dark px-2.5 py-1">Picked Up</span>;
      case 'IN_TRANSIT':
      case 'OUT_FOR_DELIVERY':
      case 'ARRIVED_AT_SORTING_CENTER':
      case 'ARRIVED_AT_DESTINATION':
        return <span className="badge bg-warning text-dark px-2.5 py-1">In Transit</span>;
      case 'DELIVERED':
        return <span className="badge bg-success text-white px-2.5 py-1">Delivered</span>;
      case 'FAILED':
      case 'FAILED_DELIVERY':
      case 'DELIVERY_ATTEMPT_FAILED':
      case 'DELAYED':
        return <span className="badge bg-danger text-white px-2.5 py-1">Failed</span>;
      default:
        return <span className="badge bg-light text-slate-700 border px-2.5 py-1">{status}</span>;
    }
  };

  return (
    <div className="container-fluid py-3 px-3 px-md-4">
      {/* Page Header */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <div className="d-flex align-items-center gap-2">
            <h3 className="fw-bolder text-slate-900 mb-0 tracking-tight">Live Shipments &amp; Delivery Tracking</h3>
            <span className="badge bg-primary-subtle text-primary border border-primary-subtle font-mono text-xs">
              Live Console
            </span>
          </div>
          <p className="text-slate-500 text-xs mb-0 mt-1">
            Real-time delivery progress monitoring, driver assignments, and customer package handover tracking.
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          {/* Auto Refresh Toggle */}
          <div className="form-check form-switch me-2 d-none d-sm-flex align-items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-pill shadow-sm">
            <input
              className="form-check-input mt-0"
              type="checkbox"
              id="livePollingSwitch"
              checked={autoRefreshEnabled}
              onChange={(e) => setAutoRefreshEnabled(e.target.checked)}
            />
            <label className="form-check-label text-xs fw-semibold text-slate-700 mb-0" htmlFor="livePollingSwitch">
              {autoRefreshEnabled ? (
                <span className="text-success d-flex align-items-center gap-1">
                  <span className="spinner-grow spinner-grow-sm text-success" style={{ width: '8px', height: '8px' }}></span>
                  Live Auto-Refresh (12s)
                </span>
              ) : (
                <span className="text-muted">Auto-Refresh Paused</span>
              )}
            </label>
          </div>

          <button
            onClick={() => fetchShipments(true)}
            className="btn btn-outline-secondary btn-sm rounded-pill px-3 py-2 text-xs font-bold d-flex align-items-center gap-1 shadow-sm"
            title="Refresh now"
          >
            <i className={`bi bi-arrow-clockwise ${refreshing ? 'spin' : ''}`}></i>
            <span className="d-none d-sm-inline">Refresh</span>
          </button>

          <button
            onClick={() => {
              fetchAssignmentData();
              setAssignModalOpen(true);
            }}
            className="btn btn-primary btn-sm rounded-pill px-3.5 py-2 text-xs font-bold shadow-sm d-flex align-items-center gap-1.5"
          >
            <i className="bi bi-plus-circle-fill"></i>
            <span>Assign Delivery</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback.text && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show rounded-3 py-2.5 px-3 text-xs mb-3`} role="alert">
          <i className={`bi ${feedback.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} me-1.5`}></i>
          {feedback.text}
          <button type="button" className="btn-close py-2" onClick={() => setFeedback({ type: '', text: '' })}></button>
        </div>
      )}

      {/* 7 KPI Counter Cards */}
      <div className="row g-2 mb-4">
        {/* Total Active */}
        <div className="col-6 col-md-3 col-xl">
          <div
            className={`card border-0 shadow-sm rounded-3 p-3 bg-white border-top border-4 border-slate-700 cursor-pointer transition ${statusFilter === '' ? 'ring-2 ring-slate-700 shadow' : ''}`}
            onClick={() => setStatusFilter('')}
          >
            <span className="text-muted text-[11px] text-uppercase fw-bold">Active Shipments</span>
            <div className="d-flex align-items-baseline justify-content-between mt-1">
              <h3 className="fw-bolder text-slate-900 mb-0">{stats.total_active}</h3>
              <i className="bi bi-truck fs-5 text-slate-400"></i>
            </div>
            <small className="text-slate-400 text-[10px] mt-1 d-block">All ongoing tasks</small>
          </div>
        </div>

        {/* Prepared */}
        <div className="col-6 col-md-3 col-xl">
          <div
            className={`card border-0 shadow-sm rounded-3 p-3 bg-white border-top border-4 border-secondary cursor-pointer transition ${statusFilter === 'PREPARED' ? 'ring-2 ring-secondary shadow' : ''}`}
            onClick={() => setStatusFilter('PREPARED')}
          >
            <span className="text-muted text-[11px] text-uppercase fw-bold">Prepared</span>
            <div className="d-flex align-items-baseline justify-content-between mt-1">
              <h3 className="fw-bolder text-secondary mb-0">{stats.prepared}</h3>
              <i className="bi bi-box-seam fs-5 text-secondary"></i>
            </div>
            <small className="text-muted text-[10px] mt-1 d-block">Packed &amp; waiting</small>
          </div>
        </div>

        {/* Assigned */}
        <div className="col-6 col-md-3 col-xl">
          <div
            className={`card border-0 shadow-sm rounded-3 p-3 bg-white border-top border-4 border-primary cursor-pointer transition ${statusFilter === 'ASSIGNED' ? 'ring-2 ring-primary shadow' : ''}`}
            onClick={() => setStatusFilter('ASSIGNED')}
          >
            <span className="text-muted text-[11px] text-uppercase fw-bold">Assigned</span>
            <div className="d-flex align-items-baseline justify-content-between mt-1">
              <h3 className="fw-bolder text-primary mb-0">{stats.assigned}</h3>
              <i className="bi bi-person-check-fill fs-5 text-primary"></i>
            </div>
            <small className="text-muted text-[10px] mt-1 d-block">Assigned to driver</small>
          </div>
        </div>

        {/* Picked Up */}
        <div className="col-6 col-md-3 col-xl">
          <div
            className={`card border-0 shadow-sm rounded-3 p-3 bg-white border-top border-4 border-info cursor-pointer transition ${statusFilter === 'PICKED_UP' ? 'ring-2 ring-info shadow' : ''}`}
            onClick={() => setStatusFilter('PICKED_UP')}
          >
            <span className="text-muted text-[11px] text-uppercase fw-bold">Picked Up</span>
            <div className="d-flex align-items-baseline justify-content-between mt-1">
              <h3 className="fw-bolder text-info mb-0">{stats.picked_up}</h3>
              <i className="bi bi-box-arrow-up-right fs-5 text-info"></i>
            </div>
            <small className="text-muted text-[10px] mt-1 d-block">Collected from dock</small>
          </div>
        </div>

        {/* In Transit */}
        <div className="col-6 col-md-3 col-xl">
          <div
            className={`card border-0 shadow-sm rounded-3 p-3 bg-white border-top border-4 border-warning cursor-pointer transition ${statusFilter === 'IN_TRANSIT' ? 'ring-2 ring-warning shadow' : ''}`}
            onClick={() => setStatusFilter('IN_TRANSIT')}
          >
            <span className="text-muted text-[11px] text-uppercase fw-bold">In Transit</span>
            <div className="d-flex align-items-baseline justify-content-between mt-1">
              <h3 className="fw-bolder text-warning mb-0">{stats.in_transit}</h3>
              <i className="bi bi-bicycle fs-5 text-warning"></i>
            </div>
            <small className="text-muted text-[10px] mt-1 d-block">En route to customer</small>
          </div>
        </div>

        {/* Delivered */}
        <div className="col-6 col-md-3 col-xl">
          <div
            className={`card border-0 shadow-sm rounded-3 p-3 bg-white border-top border-4 border-success cursor-pointer transition ${statusFilter === 'DELIVERED' ? 'ring-2 ring-success shadow' : ''}`}
            onClick={() => setStatusFilter('DELIVERED')}
          >
            <span className="text-muted text-[11px] text-uppercase fw-bold">Delivered</span>
            <div className="d-flex align-items-baseline justify-content-between mt-1">
              <h3 className="fw-bolder text-success mb-0">{stats.delivered}</h3>
              <i className="bi bi-check2-circle fs-5 text-success"></i>
            </div>
            <small className="text-muted text-[10px] mt-1 d-block">Handover confirmed</small>
          </div>
        </div>

        {/* Failed */}
        <div className="col-6 col-md-3 col-xl">
          <div
            className={`card border-0 shadow-sm rounded-3 p-3 bg-white border-top border-4 border-danger cursor-pointer transition ${statusFilter === 'FAILED' ? 'ring-2 ring-danger shadow' : ''}`}
            onClick={() => setStatusFilter('FAILED')}
          >
            <span className="text-muted text-[11px] text-uppercase fw-bold">Failed / Delayed</span>
            <div className="d-flex align-items-baseline justify-content-between mt-1">
              <h3 className="fw-bolder text-danger mb-0">{stats.failed}</h3>
              <i className="bi bi-exclamation-octagon fs-5 text-danger"></i>
            </div>
            <small className="text-muted text-[10px] mt-1 d-block">Attempt unsuccessful</small>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white border border-slate-200">
        {/* Controls Bar */}
        <div className="card-header bg-white py-3 px-3 px-md-4 border-bottom">
          <div className="row g-2 align-items-center">
            {/* Search Input */}
            <div className="col-12 col-md-5">
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-light border-end-0"><i className="bi bi-search text-muted"></i></span>
                <input
                  type="text"
                  className="form-control bg-light border-start-0 text-xs"
                  placeholder="Search by Order ID, Customer, Driver, Address, City..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button className="btn btn-outline-secondary btn-sm" onClick={() => setSearch('')}>Clear</button>
                )}
              </div>
            </div>

            {/* Filter Pills */}
            <div className="col-12 col-md-7 d-flex justify-content-md-end gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              <button
                className={`btn btn-xs rounded-pill px-3 py-1 font-bold text-xs ${statusFilter === '' ? 'btn-primary' : 'btn-light text-slate-600'}`}
                onClick={() => setStatusFilter('')}
              >
                All
              </button>
              <button
                className={`btn btn-xs rounded-pill px-3 py-1 font-bold text-xs ${statusFilter === 'PREPARED' ? 'btn-primary' : 'btn-light text-slate-600'}`}
                onClick={() => setStatusFilter('PREPARED')}
              >
                Prepared
              </button>
              <button
                className={`btn btn-xs rounded-pill px-3 py-1 font-bold text-xs ${statusFilter === 'ASSIGNED' ? 'btn-primary' : 'btn-light text-slate-600'}`}
                onClick={() => setStatusFilter('ASSIGNED')}
              >
                Assigned
              </button>
              <button
                className={`btn btn-xs rounded-pill px-3 py-1 font-bold text-xs ${statusFilter === 'PICKED_UP' ? 'btn-primary' : 'btn-light text-slate-600'}`}
                onClick={() => setStatusFilter('PICKED_UP')}
              >
                Picked Up
              </button>
              <button
                className={`btn btn-xs rounded-pill px-3 py-1 font-bold text-xs ${statusFilter === 'IN_TRANSIT' ? 'btn-primary' : 'btn-light text-slate-600'}`}
                onClick={() => setStatusFilter('IN_TRANSIT')}
              >
                In Transit
              </button>
              <button
                className={`btn btn-xs rounded-pill px-3 py-1 font-bold text-xs ${statusFilter === 'DELIVERED' ? 'btn-primary' : 'btn-light text-slate-600'}`}
                onClick={() => setStatusFilter('DELIVERED')}
              >
                Delivered
              </button>
              <button
                className={`btn btn-xs rounded-pill px-3 py-1 font-bold text-xs ${statusFilter === 'FAILED' ? 'btn-primary' : 'btn-light text-slate-600'}`}
                onClick={() => setStatusFilter('FAILED')}
              >
                Failed
              </button>
            </div>
          </div>
        </div>

        {/* Shipments Table */}
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0 text-sm">
            <thead className="table-light text-slate-600 text-xs text-uppercase font-semibold">
              <tr>
                <th className="ps-4">Order ID &amp; Ref</th>
                <th>Customer</th>
                <th>Delivery Person / Courier</th>
                <th>Delivery Address</th>
                <th>Current Status</th>
                <th>Expected Date</th>
                <th>Last Updated</th>
                <th className="text-end pe-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-5 text-muted">
                    <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                    Loading live shipments...
                  </td>
                </tr>
              ) : shipments.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-5 text-muted">
                    <i className="bi bi-inbox fs-3 d-block text-slate-300 mb-2"></i>
                    No shipments match the current filters.
                  </td>
                </tr>
              ) : (
                shipments.map((s) => {
                  const assignedName = s.personnel_name || s.courier_name || s.pickup_driver_name || 'Unassigned';
                  const isDriver = !!s.delivery_personnel;
                  const isCourier = !!s.courier_company;

                  return (
                    <tr key={s.id}>
                      {/* Order ID */}
                      <td className="ps-4">
                        <div className="fw-bold font-mono text-slate-900">{s.order_number}</div>
                        <span className="badge bg-slate-100 text-slate-600 border font-mono text-[11px]">
                          {s.tracking_number}
                        </span>
                      </td>

                      {/* Customer */}
                      <td>
                        <div className="fw-semibold text-slate-800">{s.recipient_name || s.customer_username}</div>
                        <div className="text-muted text-xs">
                          <i className="bi bi-telephone me-1"></i>{s.recipient_phone || 'N/A'}
                        </div>
                      </td>

                      {/* Delivery Person / Courier */}
                      <td>
                        <div className="d-flex align-items-center gap-1.5">
                          <i
                            className={`bi ${
                              isDriver ? 'bi-bicycle text-primary' : isCourier ? 'bi-building text-info' : 'bi-dash-circle text-muted'
                            }`}
                          ></i>
                          <span className="fw-semibold text-slate-800 text-xs">{assignedName}</span>
                        </div>
                        {s.vehicle_plate && (
                          <span className="badge bg-light text-slate-600 border text-[10px] mt-0.5">
                            {s.vehicle_plate}
                          </span>
                        )}
                      </td>

                      {/* Delivery Address */}
                      <td>
                        <div className="text-truncate text-slate-700 text-xs" style={{ maxWidth: '200px' }} title={s.delivery_address}>
                          {s.delivery_address || 'Address on file'}
                        </div>
                        <small className="text-muted text-[11px]">{s.destination_city || 'Addis Ababa'}</small>
                      </td>

                      {/* Current Status */}
                      <td>{getStatusBadge(s.status)}</td>

                      {/* Expected Delivery Date */}
                      <td>
                        {s.estimated_delivery_date ? (
                          <span className="fw-semibold text-slate-700 text-xs">
                            <i className="bi bi-calendar3 me-1 text-primary"></i>
                            {s.estimated_delivery_date}
                          </span>
                        ) : (
                          <span className="text-muted text-xs">Standard</span>
                        )}
                      </td>

                      {/* Last Updated */}
                      <td>
                        <small className="text-muted text-xs font-mono">
                          {s.updated_at ? new Date(s.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                        </small>
                      </td>

                      {/* Actions */}
                      <td className="text-end pe-4">
                        <div className="btn-group btn-group-sm">
                          <button
                            className="btn btn-outline-secondary rounded-pill px-2.5 py-1 text-xs"
                            onClick={() => handleOpenDetail(s)}
                            title="View tracking history & details"
                          >
                            <i className="bi bi-eye"></i> Details
                          </button>
                          <button
                            className="btn btn-outline-primary rounded-pill px-2.5 py-1 text-xs ms-1"
                            onClick={() => handleOpenStatusModal(s)}
                            title="Update shipment milestone"
                          >
                            <i className="bi bi-arrow-repeat"></i> Update
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Info */}
        <div className="card-footer bg-white py-2.5 px-4 d-flex align-items-center justify-content-between text-xs text-muted">
          <span>Showing <strong>{shipments.length}</strong> shipment records.</span>
          <span>Last sync: {lastUpdatedTime.toLocaleTimeString()}</span>
        </div>
      </div>

      {/* ============================================================== */}
      {/* MODAL 1: ASSIGN DELIVERY TO EXISTING ORDER */}
      {/* ============================================================== */}
      {assignModalOpen && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content rounded-4 border-0 shadow">
              <div className="modal-header border-0 pb-0">
                <div className="d-flex align-items-center gap-2">
                  <div className="rounded-circle bg-primary bg-opacity-10 text-primary p-2">
                    <i className="bi bi-box-arrow-in-down fs-5"></i>
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold text-slate-900 mb-0">Assign Order for Delivery</h5>
                    <small className="text-muted text-xs">Select customer order, assign driver or courier, and set expected delivery date.</small>
                  </div>
                </div>
                <button type="button" className="btn-close" onClick={() => setAssignModalOpen(false)}></button>
              </div>

              <form onSubmit={handleSaveAssignment}>
                <div className="modal-body text-sm">
                  {/* Select Customer Order */}
                  <div className="mb-3">
                    <label className="form-label fw-bold text-slate-800">Select Customer Order *</label>
                    <select
                      className="form-select"
                      required
                      value={selectedOrderId}
                      onChange={handleOrderChange}
                    >
                      <option value="">-- Choose verified customer order --</option>
                      {eligibleOrders.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.order_number} &bull; {o.customer_name} &bull; {formatETB(o.total_amount)} ({o.shipping_city}) [{o.shipment_status_display}]
                        </option>
                      ))}
                    </select>
                    {eligibleOrders.length === 0 && !loadingOrders && (
                      <small className="text-muted text-[11px] mt-1 d-block">
                        No active unassigned orders currently waiting for delivery.
                      </small>
                    )}
                  </div>

                  {/* Delivery Mode Choice */}
                  <div className="mb-3">
                    <label className="form-label fw-bold text-slate-800">Delivery Assignment Method *</label>
                    <div className="d-flex gap-3">
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="assignMethod"
                          id="methodOwn"
                          value="OWN_DELIVERY"
                          checked={assignMethod === 'OWN_DELIVERY'}
                          onChange={() => setAssignMethod('OWN_DELIVERY')}
                        />
                        <label className="form-check-label fw-semibold" htmlFor="methodOwn">
                          <i className="bi bi-bicycle me-1 text-primary"></i> Own Delivery Fleet / Driver
                        </label>
                      </div>
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="assignMethod"
                          id="methodCourier"
                          value="THIRD_PARTY_COURIER"
                          checked={assignMethod === 'THIRD_PARTY_COURIER'}
                          onChange={() => setAssignMethod('THIRD_PARTY_COURIER')}
                        />
                        <label className="form-check-label fw-semibold" htmlFor="methodCourier">
                          <i className="bi bi-building me-1 text-info"></i> Third-Party Regional Courier
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Driver vs Courier selection */}
                  {assignMethod === 'OWN_DELIVERY' ? (
                    <div className="mb-3">
                      <label className="form-label fw-bold text-slate-800">Assign Delivery Personnel / Driver *</label>
                      <select
                        className="form-select"
                        required
                        value={assignPersonnelId}
                        onChange={(e) => setAssignPersonnelId(e.target.value)}
                      >
                        <option value="">-- Select active delivery driver --</option>
                        {personnelList.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.full_name} &bull; {p.phone_number} &bull; {p.vehicle_type} ({p.vehicle_registration_number || 'Plate N/A'}) [{p.is_available ? 'Available' : 'Busy'}]
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="mb-3">
                      <label className="form-label fw-bold text-slate-800">Select Courier Company Partner *</label>
                      <select
                        className="form-select"
                        required
                        value={assignCourierId}
                        onChange={(e) => setAssignCourierId(e.target.value)}
                      >
                        <option value="">-- Select registered courier partner --</option>
                        {couriersList.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.code}) &bull; Contact: {c.phone_number} &bull; Hubs: {c.supported_destination_cities}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Delivery Address & Expected Date */}
                  <div className="row g-3 mb-3">
                    <div className="col-12 col-md-8">
                      <label className="form-label fw-semibold">Delivery Address *</label>
                      <input
                        type="text"
                        className="form-control"
                        required
                        value={assignDeliveryAddress}
                        onChange={(e) => setAssignDeliveryAddress(e.target.value)}
                        placeholder="Street, sub-city, house number, nearby landmark"
                      />
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label fw-semibold">Expected Delivery Date *</label>
                      <input
                        type="date"
                        className="form-control"
                        required
                        value={assignExpectedDate}
                        onChange={(e) => setAssignExpectedDate(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="mb-2">
                    <label className="form-label fw-semibold">Delivery Notes &amp; Dispatch Instructions</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      value={assignNotes}
                      onChange={(e) => setAssignNotes(e.target.value)}
                      placeholder="Special handling instructions, delivery time window, customer gate note..."
                    />
                  </div>
                </div>

                <div className="modal-footer border-0 pt-0">
                  <button type="button" className="btn btn-light rounded-pill px-4 text-xs font-bold" onClick={() => setAssignModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary rounded-pill px-4 text-xs font-bold shadow-sm" disabled={submittingAssign}>
                    {submittingAssign ? (
                      <span><span className="spinner-border spinner-border-sm me-1"></span>Saving Assignment...</span>
                    ) : (
                      <span><i className="bi bi-check2-circle me-1"></i> Save Assignment</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: SHIPMENT DETAILS & TRACKING TIMELINE */}
      {/* ============================================================== */}
      {detailModalOpen && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content rounded-4 border-0 shadow">
              <div className="modal-header border-0 pb-0">
                <div>
                  <h5 className="modal-title fw-bold text-slate-900 mb-0">
                    Shipment Tracking: <span className="text-primary font-mono">{detailShipment?.tracking_number}</span>
                  </h5>
                  <small className="text-muted text-xs">
                    Order Ref: <strong>{detailShipment?.order_number}</strong>
                  </small>
                </div>
                <button type="button" className="btn-close" onClick={() => setDetailModalOpen(false)}></button>
              </div>

              <div className="modal-body text-sm">
                {loadingDetail ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status"></div>
                    <p className="text-muted text-xs mt-2">Loading shipment timeline...</p>
                  </div>
                ) : detailShipment ? (
                  <>
                    {/* Header Summary Cards */}
                    <div className="p-3 bg-light rounded-3 mb-3 border">
                      <div className="row g-2">
                        <div className="col-6 col-md-3">
                          <span className="text-muted text-[11px] text-uppercase d-block">Status</span>
                          <div className="mt-0.5">{getStatusBadge(detailShipment.status)}</div>
                        </div>
                        <div className="col-6 col-md-3">
                          <span className="text-muted text-[11px] text-uppercase d-block">Assigned To</span>
                          <strong className="text-slate-800 text-xs">
                            {detailShipment.delivery_personnel?.full_name || detailShipment.courier_company?.name || 'Unassigned'}
                          </strong>
                        </div>
                        <div className="col-6 col-md-3">
                          <span className="text-muted text-[11px] text-uppercase d-block">Expected Date</span>
                          <span className="text-slate-700 text-xs fw-semibold">{detailShipment.estimated_delivery_date || 'Standard'}</span>
                        </div>
                        <div className="col-6 col-md-3">
                          <span className="text-muted text-[11px] text-uppercase d-block">Confirmation Code</span>
                          <span className="badge bg-success bg-opacity-10 text-success border border-success font-mono text-xs">
                            {detailShipment.delivery_confirmation_code || 'Auto-Generated'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Customer & Address Details */}
                    <div className="row g-3 mb-3">
                      <div className="col-12 col-md-6">
                        <div className="card p-2.5 rounded-3 bg-white border h-100">
                          <span className="text-muted text-[11px] text-uppercase fw-bold mb-1">Customer Delivery Details</span>
                          <div className="fw-bold text-slate-800">{detailShipment.recipient_name}</div>
                          <div className="text-slate-600 text-xs mt-0.5">
                            <i className="bi bi-telephone me-1 text-primary"></i>{detailShipment.recipient_phone}
                          </div>
                          <div className="text-slate-600 text-xs mt-1">
                            <i className="bi bi-geo-alt me-1 text-danger"></i>{detailShipment.delivery_address} ({detailShipment.destination_city})
                          </div>
                        </div>
                      </div>

                      <div className="col-12 col-md-6">
                        <div className="card p-2.5 rounded-3 bg-white border h-100">
                          <span className="text-muted text-[11px] text-uppercase fw-bold mb-1">Order Package Contents</span>
                          {detailShipment.order_items && detailShipment.order_items.length > 0 ? (
                            detailShipment.order_items.map((it, idx) => (
                              <div key={idx} className="d-flex justify-content-between text-xs py-0.5">
                                <span>{it.quantity}x {it.product_name}</span>
                                <span className="font-mono text-muted">{formatETB(it.subtotal || it.unit_price * it.quantity)}</span>
                              </div>
                            ))
                          ) : (
                            <span className="text-muted text-xs">Standard verified order contents</span>
                          )}
                          <div className="border-top pt-1 mt-1 d-flex justify-content-between fw-bold text-xs">
                            <span>Total</span>
                            <span className="text-primary">{formatETB(detailShipment.order_total || 0)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Tracking Events Timeline */}
                    <h6 className="fw-bold text-slate-900 mb-2 mt-3">Shipment Milestone Audit Log</h6>
                    <div className="table-responsive bg-light rounded-3 border">
                      <table className="table table-sm table-borderless align-middle mb-0 text-xs">
                        <thead className="table-light border-bottom text-muted">
                          <tr>
                            <th className="ps-3">Timestamp</th>
                            <th>Status Transition</th>
                            <th>Location</th>
                            <th>Note / Description</th>
                            <th>Updated By</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailShipment.events && detailShipment.events.length > 0 ? (
                            detailShipment.events.map((ev, idx) => (
                              <tr key={idx} className="border-bottom">
                                <td className="ps-3 font-mono text-muted">
                                  {new Date(ev.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td>
                                  {ev.previous_status && (
                                    <span className="text-muted me-1">{ev.previous_status} &rarr;</span>
                                  )}
                                  <strong className="text-slate-800">{ev.status}</strong>
                                </td>
                                <td>{ev.location || 'Fulfillment Hub'}</td>
                                <td className="text-slate-600">{ev.delivery_note || ev.description}</td>
                                <td className="text-muted">{ev.updated_by_name || 'System'}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="5" className="text-center py-3 text-muted">No status transitions recorded yet.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : null}
              </div>

              <div className="modal-footer border-0 pt-0">
                <button type="button" className="btn btn-secondary rounded-pill px-4 text-xs font-bold" onClick={() => setDetailModalOpen(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: UPDATE SHIPMENT STATUS */}
      {/* ============================================================== */}
      {statusModalOpen && selectedShipment && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 border-0 shadow">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold text-slate-900">
                  Update Shipment: <span className="text-primary font-mono">{selectedShipment.tracking_number}</span>
                </h5>
                <button type="button" className="btn-close" onClick={() => setStatusModalOpen(false)}></button>
              </div>

              <form onSubmit={handleSaveStatus}>
                <div className="modal-body text-sm">
                  <div className="mb-3">
                    <label className="form-label fw-bold">Select Target Status *</label>
                    <select
                      className="form-select"
                      value={targetStatus}
                      onChange={(e) => setTargetStatus(e.target.value)}
                    >
                      <option value="PREPARED">PREPARED (Packed &amp; Ready)</option>
                      <option value="ASSIGNED">ASSIGNED (Assigned to driver/courier)</option>
                      <option value="PICKED_UP">PICKED_UP (Driver picked up package)</option>
                      <option value="IN_TRANSIT">IN_TRANSIT (En route to destination)</option>
                      <option value="FAILED">FAILED (Delivery attempt unsuccessful)</option>
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Location</label>
                    <input
                      type="text"
                      className="form-control"
                      value={statusLocation}
                      onChange={(e) => setStatusLocation(e.target.value)}
                      placeholder="Addis Ababa, Bole Hub, Hawassa..."
                    />
                  </div>

                  <div className="mb-2">
                    <label className="form-label fw-semibold">Milestone Note / Description</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      value={statusNote}
                      onChange={(e) => setStatusNote(e.target.value)}
                      placeholder="Reason for change, transit checkpoint, handling notes..."
                    />
                  </div>
                </div>

                <div className="modal-footer border-0 pt-0">
                  <button type="button" className="btn btn-light rounded-pill px-4 text-xs font-bold" onClick={() => setStatusModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary rounded-pill px-4 text-xs font-bold" disabled={submittingStatus}>
                    {submittingStatus ? 'Saving...' : 'Update Status'}
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

export default LiveShipmentsPage;

