import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api';
import { validateEmail, validatePhone } from '../../utils/validation';
import { formatETB } from '../../utils/currency';

const AdminDeliveryHubPage = () => {
  const [activeTab, setActiveTab] = useState('couriers'); // 'couriers', 'vehicles', 'personnel', 'rules', 'shipments', 'complaints'
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // 1. Couriers State
  const [couriers, setCouriers] = useState([]);
  const [loadingCouriers, setLoadingCouriers] = useState(false);
  const [courierModalOpen, setCourierModalOpen] = useState(false);
  const [editingCourier, setEditingCourier] = useState(null);
  const [courierFormData, setCourierFormData] = useState({
    name: '',
    code: '',
    contact_person: '',
    phone_number: '',
    email: '',
    office_address: '',
    origin_city: 'Addis Ababa',
    supported_destination_cities: 'Bahir Dar, Hawassa, Adama, Mekelle, Dire Dawa',
    service_description: '',
    tracking_url_template: '',
    is_active: true,
  });

  // Performance modal
  const [perfModalOpen, setPerfModalOpen] = useState(false);
  const [perfData, setPerfData] = useState(null);
  const [loadingPerf, setLoadingPerf] = useState(false);

  // 2. Vehicles State
  const [vehicles, setVehicles] = useState([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [vehicleFormData, setVehicleFormData] = useState({
    registration_number: '',
    vehicle_type: 'VAN',
    model: '',
    driver_name: '',
    driver_phone: '',
    current_city: 'Addis Ababa',
    status: 'AVAILABLE',
    is_active: true,
  });

  // 3. Personnel State
  const [personnel, setPersonnel] = useState([]);
  const [loadingPersonnel, setLoadingPersonnel] = useState(false);
  const [personnelModalOpen, setPersonnelModalOpen] = useState(false);
  const [editingPersonnel, setEditingPersonnel] = useState(null);
  const [personnelFormData, setPersonnelFormData] = useState({
    full_name: '',
    phone_number: '',
    email: '',
    employee_code: '',
    vehicle_type: 'Motorcycle',
    vehicle_registration_number: '',
    delivery_area: 'Addis Ababa Central Zone',
    status: 'ACTIVE',
    delivery_method: 'OWN_FLEET',
    courier_company: '',
    current_city: 'Addis Ababa',
    is_available: true,
    is_active: true,
  });

  // 4. Fee Rules State
  const [feeRules, setFeeRules] = useState([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [ruleFormData, setRuleFormData] = useState({
    origin_city: 'Addis Ababa',
    destination_city: '',
    delivery_method: 'ALL',
    base_fee: '150.00',
    per_kg_fee: '30.00',
    estimated_days_min: 1,
    estimated_days_max: 3,
    is_active: true,
  });

  // 5. Global Shipments & Complaints
  const [shipments, setShipments] = useState([]);
  const [loadingShipments, setLoadingShipments] = useState(false);
  const [shipmentSearch, setShipmentSearch] = useState('');
  const [complaints, setComplaints] = useState([]);
  const [loadingComplaints, setLoadingComplaints] = useState(false);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolutionStatus, setResolutionStatus] = useState('RESOLVED');

  // Load Data Handlers
  const fetchCouriers = useCallback(async () => {
    try {
      setLoadingCouriers(true);
      const res = await api.get('delivery/couriers/');
      setCouriers(res.data.results || res.data || []);
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'danger', text: 'Failed to load courier companies.' });
    } finally {
      setLoadingCouriers(false);
    }
  }, []);

  const fetchVehicles = useCallback(async () => {
    try {
      setLoadingVehicles(true);
      const res = await api.get('delivery/vehicles/');
      setVehicles(res.data.results || res.data || []);
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'danger', text: 'Failed to load delivery vehicles.' });
    } finally {
      setLoadingVehicles(false);
    }
  }, []);

  const fetchPersonnel = useCallback(async () => {
    try {
      setLoadingPersonnel(true);
      const res = await api.get('delivery/personnel/');
      setPersonnel(res.data.results || res.data || []);
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'danger', text: 'Failed to load delivery personnel.' });
    } finally {
      setLoadingPersonnel(false);
    }
  }, []);

  const fetchFeeRules = useCallback(async () => {
    try {
      setLoadingRules(true);
      const res = await api.get('delivery/rules/');
      setFeeRules(res.data.results || res.data || []);
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'danger', text: 'Failed to load delivery fee rules.' });
    } finally {
      setLoadingRules(false);
    }
  }, []);

  const fetchShipments = useCallback(async () => {
    try {
      setLoadingShipments(true);
      const res = await api.get(`delivery/shipments/?search=${encodeURIComponent(shipmentSearch)}`);
      setShipments(res.data.results || res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingShipments(false);
    }
  }, [shipmentSearch]);

  const fetchComplaints = useCallback(async () => {
    try {
      setLoadingComplaints(true);
      const res = await api.get('delivery/complaints/');
      setComplaints(res.data.results || res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingComplaints(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'couriers') fetchCouriers();
    if (activeTab === 'vehicles') fetchVehicles();
    if (activeTab === 'personnel') {
      fetchPersonnel();
      fetchCouriers();
    }
    if (activeTab === 'rules') fetchFeeRules();
    if (activeTab === 'shipments') fetchShipments();
    if (activeTab === 'complaints') fetchComplaints();
  }, [activeTab, fetchCouriers, fetchVehicles, fetchPersonnel, fetchFeeRules, fetchShipments, fetchComplaints]);

  // Courier Actions
  const handleSaveCourier = async (e) => {
    e.preventDefault();
    const phoneRes = validatePhone(courierFormData.phone_number, true);
    if (!phoneRes.isValid) {
      setFeedback({ type: 'danger', text: phoneRes.error });
      return;
    }
    const emailRes = validateEmail(courierFormData.email, true);
    if (!emailRes.isValid) {
      setFeedback({ type: 'danger', text: emailRes.error });
      return;
    }
    try {
      const payload = {
        ...courierFormData,
        supported_destination_cities: courierFormData.supported_destination_cities
          ? courierFormData.supported_destination_cities.split(',').map((c) => c.trim()).filter(Boolean)
          : [],
      };
      if (editingCourier) {
        await api.put(`delivery/couriers/${editingCourier.id}/`, payload);
        setFeedback({ type: 'success', text: `Courier "${payload.name}" updated successfully.` });
      } else {
        await api.post('delivery/couriers/', payload);
        setFeedback({ type: 'success', text: `Courier "${payload.name}" registered successfully.` });
      }
      setCourierModalOpen(false);
      fetchCouriers();
    } catch (err) {
      setFeedback({ type: 'danger', text: err.response?.data?.error || 'Failed to save courier company.' });
    }
  };

  const handleOpenCourierPerformance = async (courierId) => {
    try {
      setLoadingPerf(true);
      setPerfModalOpen(true);
      const res = await api.get(`delivery/couriers/${courierId}/performance/`);
      setPerfData(res.data);
    } catch (err) {
      setFeedback({ type: 'danger', text: 'Failed to load performance metrics.' });
      setPerfModalOpen(false);
    } finally {
      setLoadingPerf(false);
    }
  };

  // Vehicle Actions
  const handleSaveVehicle = async (e) => {
    e.preventDefault();
    if (vehicleFormData.driver_phone && vehicleFormData.driver_phone.trim()) {
      const phoneRes = validatePhone(vehicleFormData.driver_phone, false);
      if (!phoneRes.isValid) {
        setFeedback({ type: 'danger', text: phoneRes.error });
        return;
      }
    }
    try {
      if (editingVehicle) {
        await api.put(`delivery/vehicles/${editingVehicle.id}/`, vehicleFormData);
        setFeedback({ type: 'success', text: `Vehicle "${vehicleFormData.registration_number}" updated.` });
      } else {
        await api.post('delivery/vehicles/', vehicleFormData);
        setFeedback({ type: 'success', text: `Vehicle "${vehicleFormData.registration_number}" registered.` });
      }
      setVehicleModalOpen(false);
      fetchVehicles();
    } catch (err) {
      setFeedback({ type: 'danger', text: 'Failed to save vehicle details.' });
    }
  };

  // Personnel Actions
  const handleSavePersonnel = async (e) => {
    e.preventDefault();
    const phoneRes = validatePhone(personnelFormData.phone_number, true);
    if (!phoneRes.isValid) {
      setFeedback({ type: 'danger', text: phoneRes.error });
      return;
    }
    if (personnelFormData.email && personnelFormData.email.trim()) {
      const emailRes = validateEmail(personnelFormData.email, false);
      if (!emailRes.isValid) {
        setFeedback({ type: 'danger', text: emailRes.error });
        return;
      }
    }
    try {
      const payload = {
        ...personnelFormData,
        courier_company: personnelFormData.courier_company ? Number(personnelFormData.courier_company) : null,
      };
      if (editingPersonnel) {
        await api.put(`delivery/personnel/${editingPersonnel.id}/`, payload);
        setFeedback({ type: 'success', text: `Personnel "${personnelFormData.full_name}" updated.` });
      } else {
        await api.post('delivery/personnel/', payload);
        setFeedback({ type: 'success', text: `Personnel "${personnelFormData.full_name}" registered.` });
      }
      setPersonnelModalOpen(false);
      fetchPersonnel();
    } catch (err) {
      setFeedback({ type: 'danger', text: 'Failed to save personnel details.' });
    }
  };

  // Fee Rule Actions
  const handleSaveRule = async (e) => {
    e.preventDefault();
    try {
      if (editingRule) {
        await api.put(`delivery/rules/${editingRule.id}/`, ruleFormData);
        setFeedback({ type: 'success', text: 'Fee rule updated.' });
      } else {
        await api.post('delivery/rules/', ruleFormData);
        setFeedback({ type: 'success', text: 'Fee rule created.' });
      }
      setRuleModalOpen(false);
      fetchFeeRules();
    } catch (err) {
      setFeedback({ type: 'danger', text: 'Failed to save fee rule.' });
    }
  };

  // Complaint Resolve Action
  const handleResolveComplaint = async (e) => {
    e.preventDefault();
    if (!selectedComplaint) return;
    try {
      await api.patch(`delivery/complaints/${selectedComplaint.id}/`, {
        status: resolutionStatus,
        resolution_notes: resolutionNotes,
      });
      setFeedback({ type: 'success', text: `Complaint #${selectedComplaint.id} marked as ${resolutionStatus}.` });
      setResolveModalOpen(false);
      fetchComplaints();
    } catch (err) {
      setFeedback({ type: 'danger', text: 'Failed to update complaint.' });
    }
  };

  return (
    <div className="container-fluid py-4 px-3 px-md-4">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <div className="d-flex align-items-center gap-2">
            <h1 className="h3 fw-bolder text-slate-900 mb-0">Delivery & Logistics Hub</h1>
            <span className="badge bg-primary text-uppercase px-2.5 py-1" style={{ fontSize: '0.7rem' }}>
              Admin Operations
            </span>
          </div>
          <p className="text-muted small mb-0 mt-1">
            Centrally manage courier integrations, own delivery fleet, driver personnel, regional fee matrix, and customer disputes.
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          <span className="badge bg-light text-slate-700 border p-2 text-xs">
            <i className="bi bi-shield-check text-success me-1"></i> Customer OTP Verification Active
          </span>
          <span className="badge bg-light text-slate-700 border p-2 text-xs">
            <i className="bi bi-geo-alt-fill text-primary me-1"></i> Default Origin: Addis Ababa
          </span>
        </div>
      </div>

      {/* Dismissible Feedback Alert */}
      {feedback.text && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show rounded-3 py-2.5 px-3 text-sm mb-4`} role="alert">
          {feedback.text}
          <button type="button" className="btn-close py-2.5" onClick={() => setFeedback({ type: '', text: '' })} aria-label="Close"></button>
        </div>
      )}

      {/* Tabs Navigation */}
      <ul className="nav nav-pills gap-2 mb-4 p-1.5 bg-white rounded-3 shadow-sm border border-slate-200">
        <li className="nav-item">
          <button
            className={`nav-link py-2 px-3.5 text-xs font-bold rounded-2 ${activeTab === 'couriers' ? 'active bg-primary text-white shadow-sm' : 'text-slate-600'}`}
            onClick={() => setActiveTab('couriers')}
          >
            <i className="bi bi-buildings-fill me-1.5"></i> Courier Companies ({couriers.length})
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link py-2 px-3.5 text-xs font-bold rounded-2 ${activeTab === 'vehicles' ? 'active bg-primary text-white shadow-sm' : 'text-slate-600'}`}
            onClick={() => setActiveTab('vehicles')}
          >
            <i className="bi bi-truck-front-fill me-1.5"></i> Own Fleet Vehicles ({vehicles.length})
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link py-2 px-3.5 text-xs font-bold rounded-2 ${activeTab === 'personnel' ? 'active bg-primary text-white shadow-sm' : 'text-slate-600'}`}
            onClick={() => setActiveTab('personnel')}
          >
            <i className="bi bi-person-badge-fill me-1.5"></i> Delivery Personnel ({personnel.length})
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link py-2 px-3.5 text-xs font-bold rounded-2 ${activeTab === 'rules' ? 'active bg-primary text-white shadow-sm' : 'text-slate-600'}`}
            onClick={() => setActiveTab('rules')}
          >
            <i className="bi bi-cash-coin me-1.5"></i> Delivery Fee Matrix ({feeRules.length})
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link py-2 px-3.5 text-xs font-bold rounded-2 ${activeTab === 'shipments' ? 'active bg-primary text-white shadow-sm' : 'text-slate-600'}`}
            onClick={() => setActiveTab('shipments')}
          >
            <i className="bi bi-box-seam-fill me-1.5"></i> Live Shipments
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link py-2 px-3.5 text-xs font-bold rounded-2 ${activeTab === 'complaints' ? 'active bg-primary text-white shadow-sm' : 'text-slate-600'}`}
            onClick={() => setActiveTab('complaints')}
          >
            <i className="bi bi-exclamation-triangle-fill text-warning me-1.5"></i> Delivery Complaints ({complaints.filter((c) => c.status === 'OPEN').length})
          </button>
        </li>
      </ul>

      {/* ============================================================== */}
      {/* TAB 1: COURIER COMPANIES */}
      {/* ============================================================== */}
      {activeTab === 'couriers' && (
        <div className="card border-0 shadow-sm rounded-4 overflow-hidden border border-slate-200">
          <div className="card-header bg-white py-3 px-4 d-flex justify-content-between align-items-center">
            <div>
              <h5 className="fw-bold mb-0 text-slate-800">Third-Party Courier Partners</h5>
              <span className="text-muted text-xs">External transport logistics companies carrying intercity cargo.</span>
            </div>
            <button
              className="btn btn-primary btn-sm rounded-pill px-3 py-1.5 text-xs font-bold shadow-sm"
              onClick={() => {
                setEditingCourier(null);
                setCourierFormData({
                  name: '',
                  code: '',
                  contact_person: '',
                  phone_number: '',
                  email: '',
                  office_address: '',
                  origin_city: 'Addis Ababa',
                  supported_destination_cities: 'Bahir Dar, Hawassa, Adama, Mekelle, Dire Dawa',
                  service_description: '',
                  tracking_url_template: '',
                  is_active: true,
                });
                setCourierModalOpen(true);
              }}
            >
              <i className="bi bi-plus-circle me-1"></i> Add Courier Partner
            </button>
          </div>

          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 text-sm">
              <thead className="table-light text-slate-600 text-xs text-uppercase">
                <tr>
                  <th className="ps-4">Company Name & Code</th>
                  <th>Contact Person & Phone</th>
                  <th>Origin & Supported Hubs</th>
                  <th>Shipments & Success Rate</th>
                  <th>Status</th>
                  <th className="text-end pe-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingCouriers ? (
                  <tr>
                    <td colSpan="6" className="text-center py-4 text-muted">
                      <div className="spinner-border spinner-border-sm me-2" role="status"></div> Loading couriers...
                    </td>
                  </tr>
                ) : couriers.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-4 text-muted">No courier companies registered.</td>
                  </tr>
                ) : (
                  couriers.map((c) => (
                    <tr key={c.id}>
                      <td className="ps-4">
                        <div className="fw-bold text-slate-800">{c.name}</div>
                        <span className="badge bg-slate-100 text-slate-600 border font-mono text-xs">{c.code}</span>
                        {c.service_description?.includes('[DEMONSTRATION') && (
                          <span className="badge bg-amber-50 text-amber-700 border border-amber-200 ms-1 text-xs">
                            Demo Partner
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="text-slate-700">{c.contact_person}</div>
                        <div className="text-muted text-xs"><i className="bi bi-telephone me-1"></i>{c.phone_number}</div>
                        <div className="text-muted text-xs"><i className="bi bi-envelope me-1"></i>{c.email}</div>
                      </td>
                      <td>
                        <span className="badge bg-primary-subtle text-primary border me-1 mb-1">{c.origin_city} (Origin)</span>
                        <div className="d-flex flex-wrap gap-1 mt-1" style={{ maxWidth: '300px' }}>
                          {(c.supported_destination_cities || []).slice(0, 4).map((city, idx) => (
                            <span key={idx} className="badge bg-light text-slate-600 border text-xs">
                              {city}
                            </span>
                          ))}
                          {(c.supported_destination_cities || []).length > 4 && (
                            <span className="badge bg-light text-muted border text-xs">
                              +{c.supported_destination_cities.length - 4} more
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="fw-bold text-slate-800">{c.delivered_shipments_count} / {c.assigned_shipments_count} Delivered</div>
                        <button
                          className="btn btn-link p-0 text-primary text-xs text-decoration-none"
                          onClick={() => handleOpenCourierPerformance(c.id)}
                        >
                          <i className="bi bi-graph-up me-1"></i> View Performance
                        </button>
                      </td>
                      <td>
                        {c.is_active ? (
                          <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">Active</span>
                        ) : (
                          <span className="badge bg-secondary-subtle text-secondary border px-2 py-1">Inactive</span>
                        )}
                      </td>
                      <td className="text-end pe-4">
                        <button
                          className="btn btn-outline-secondary btn-sm rounded-pill px-2.5 py-1 text-xs me-1"
                          onClick={() => {
                            setEditingCourier(c);
                            setCourierFormData({
                              name: c.name,
                              code: c.code,
                              contact_person: c.contact_person,
                              phone_number: c.phone_number,
                              email: c.email,
                              office_address: c.office_address,
                              origin_city: c.origin_city,
                              supported_destination_cities: Array.isArray(c.supported_destination_cities)
                                ? c.supported_destination_cities.join(', ')
                                : '',
                              service_description: c.service_description,
                              tracking_url_template: c.tracking_url_template || '',
                              is_active: c.is_active,
                            });
                            setCourierModalOpen(true);
                          }}
                        >
                          <i className="bi bi-pencil"></i> Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: OWN FLEET VEHICLES */}
      {/* ============================================================== */}
      {activeTab === 'vehicles' && (
        <div className="card border-0 shadow-sm rounded-4 overflow-hidden border border-slate-200">
          <div className="card-header bg-white py-3 px-4 d-flex justify-content-between align-items-center">
            <div>
              <h5 className="fw-bold mb-0 text-slate-800">Own Delivery Fleet Vehicles</h5>
              <span className="text-muted text-xs">Company-owned vehicles registered for intra-city and local hub operations.</span>
            </div>
            <button
              className="btn btn-primary btn-sm rounded-pill px-3 py-1.5 text-xs font-bold shadow-sm"
              onClick={() => {
                setEditingVehicle(null);
                setVehicleFormData({
                  registration_number: '',
                  vehicle_type: 'VAN',
                  model: '',
                  driver_name: '',
                  driver_phone: '',
                  current_city: 'Addis Ababa',
                  status: 'AVAILABLE',
                  is_active: true,
                });
                setVehicleModalOpen(true);
              }}
            >
              <i className="bi bi-plus-circle me-1"></i> Register Vehicle
            </button>
          </div>

          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 text-sm">
              <thead className="table-light text-slate-600 text-xs text-uppercase">
                <tr>
                  <th className="ps-4">Plate Number</th>
                  <th>Type & Model</th>
                  <th>Assigned Driver & Phone</th>
                  <th>Current Hub City</th>
                  <th>Availability Status</th>
                  <th className="text-end pe-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingVehicles ? (
                  <tr>
                    <td colSpan="6" className="text-center py-4 text-muted">Loading fleet vehicles...</td>
                  </tr>
                ) : vehicles.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-4 text-muted">No company delivery vehicles registered.</td>
                  </tr>
                ) : (
                  vehicles.map((v) => (
                    <tr key={v.id}>
                      <td className="ps-4">
                        <span className="badge bg-slate-900 text-white font-mono px-2 py-1 text-xs">
                          {v.registration_number}
                        </span>
                      </td>
                      <td>
                        <div className="fw-bold text-slate-800">{v.model}</div>
                        <span className="badge bg-light text-slate-600 border text-xs">{v.vehicle_type_display}</span>
                      </td>
                      <td>
                        <div className="text-slate-800">{v.driver_name || 'Unassigned'}</div>
                        <div className="text-muted text-xs">{v.driver_phone || '—'}</div>
                      </td>
                      <td>
                        <i className="bi bi-geo-alt me-1 text-primary"></i>{v.current_city}
                      </td>
                      <td>
                        <span
                          className={`badge px-2.5 py-1 text-xs ${
                            v.status === 'AVAILABLE'
                              ? 'bg-success-subtle text-success border border-success-subtle'
                              : v.status === 'IN_USE'
                              ? 'bg-primary-subtle text-primary border border-primary-subtle'
                              : 'bg-warning-subtle text-warning border border-warning-subtle'
                          }`}
                        >
                          {v.status_display}
                        </span>
                      </td>
                      <td className="text-end pe-4">
                        <button
                          className="btn btn-outline-secondary btn-sm rounded-pill px-2.5 py-1 text-xs"
                          onClick={() => {
                            setEditingVehicle(v);
                            setVehicleFormData({
                              registration_number: v.registration_number,
                              vehicle_type: v.vehicle_type,
                              model: v.model,
                              driver_name: v.driver_name,
                              driver_phone: v.driver_phone,
                              current_city: v.current_city,
                              status: v.status,
                              is_active: v.is_active,
                            });
                            setVehicleModalOpen(true);
                          }}
                        >
                          <i className="bi bi-pencil"></i> Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: DELIVERY PERSONNEL */}
      {/* ============================================================== */}
      {activeTab === 'personnel' && (
        <div className="card border-0 shadow-sm rounded-4 overflow-hidden border border-slate-200">
          <div className="card-header bg-white py-3 px-4 d-flex justify-content-between align-items-center">
            <div>
              <h5 className="fw-bold mb-0 text-slate-800">Authorized Delivery Personnel</h5>
              <span className="text-muted text-xs">Drivers, dispatch riders, and local delivery handover agents.</span>
            </div>
            <button
              className="btn btn-primary btn-sm rounded-pill px-3 py-1.5 text-xs font-bold shadow-sm"
              onClick={() => {
                setEditingPersonnel(null);
                setPersonnelFormData({
                  full_name: '',
                  phone_number: '',
                  email: '',
                  employee_code: `EMP-DEL-${Math.floor(100 + Math.random() * 900)}`,
                  vehicle_type: 'Motorcycle',
                  vehicle_registration_number: '',
                  delivery_area: 'Addis Ababa Central Zone',
                  status: 'ACTIVE',
                  delivery_method: 'OWN_FLEET',
                  courier_company: '',
                  current_city: 'Addis Ababa',
                  is_available: true,
                  is_active: true,
                });
                setPersonnelModalOpen(true);
              }}
            >
              <i className="bi bi-plus-circle me-1"></i> Register Personnel
            </button>
          </div>

          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 text-sm">
              <thead className="table-light text-slate-600 text-xs text-uppercase">
                <tr>
                  <th className="ps-4">Employee Code & Name</th>
                  <th>Contact Info</th>
                  <th>Vehicle & Area</th>
                  <th>Delivery Assignment Scope</th>
                  <th>Status & Availability</th>
                  <th className="text-end pe-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingPersonnel ? (
                  <tr>
                    <td colSpan="6" className="text-center py-4 text-muted">Loading delivery personnel...</td>
                  </tr>
                ) : personnel.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-4 text-muted">No delivery personnel registered.</td>
                  </tr>
                ) : (
                  personnel.map((p) => (
                    <tr key={p.id}>
                      <td className="ps-4">
                        <div className="fw-bold text-slate-800">{p.full_name}</div>
                        <span className="badge bg-slate-100 text-slate-600 border font-mono text-xs">{p.employee_code}</span>
                      </td>
                      <td>
                        <div className="text-slate-700"><i className="bi bi-telephone me-1 text-primary"></i>{p.phone_number}</div>
                        <div className="text-muted text-xs"><i className="bi bi-envelope me-1"></i>{p.email || 'No email provided'}</div>
                      </td>
                      <td>
                        <div className="fw-semibold text-slate-800">
                          <i className="bi bi-bicycle me-1 text-primary"></i>{p.vehicle_type || 'Motorcycle'}
                          {p.vehicle_registration_number && (
                            <span className="text-muted text-xs ms-1">({p.vehicle_registration_number})</span>
                          )}
                        </div>
                        <div className="text-muted text-xs">
                          <i className="bi bi-geo-alt me-1"></i>{p.delivery_area || p.current_city}
                        </div>
                      </td>
                      <td>
                        <span className="badge bg-info-subtle text-info-emphasis border px-2 py-1 text-xs">
                          {p.delivery_method_display || p.delivery_method}
                        </span>
                        {p.courier_company_name && (
                          <div className="text-muted text-xs mt-1">
                            <i className="bi bi-building me-1"></i>{p.courier_company_name}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="d-flex flex-column gap-1">
                          <span className={`badge rounded-pill ${
                            p.status === 'ACTIVE' || (!p.status && p.is_active)
                              ? 'bg-success-subtle text-success border'
                              : 'bg-warning-subtle text-warning border'
                          }`}>
                            {p.status || (p.is_active ? 'ACTIVE' : 'INACTIVE')}
                          </span>
                          {p.is_available ? (
                            <span className="badge bg-primary-subtle text-primary border text-[10px]">Available</span>
                          ) : (
                            <span className="badge bg-secondary-subtle text-secondary border text-[10px]">Busy</span>
                          )}
                        </div>
                      </td>
                      <td className="text-end pe-4">
                        <button
                          className="btn btn-outline-secondary btn-sm rounded-pill px-2.5 py-1 text-xs"
                          onClick={() => {
                            setEditingPersonnel(p);
                            setPersonnelFormData({
                              full_name: p.full_name,
                              phone_number: p.phone_number,
                              email: p.email || '',
                              employee_code: p.employee_code,
                              vehicle_type: p.vehicle_type || 'Motorcycle',
                              vehicle_registration_number: p.vehicle_registration_number || '',
                              delivery_area: p.delivery_area || 'Addis Ababa Central Zone',
                              status: p.status || 'ACTIVE',
                              delivery_method: p.delivery_method,
                              courier_company: p.courier_company || '',
                              current_city: p.current_city,
                              is_available: p.is_available,
                              is_active: p.is_active,
                            });
                            setPersonnelModalOpen(true);
                          }}
                        >
                          <i className="bi bi-pencil"></i> Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4: DELIVERY FEE RULES */}
      {/* ============================================================== */}
      {activeTab === 'rules' && (
        <div className="card border-0 shadow-sm rounded-4 overflow-hidden border border-slate-200">
          <div className="card-header bg-white py-3 px-4 d-flex justify-content-between align-items-center">
            <div>
              <h5 className="fw-bold mb-0 text-slate-800">Regional Delivery Pricing Matrix</h5>
              <span className="text-muted text-xs">Configurable customer delivery fees based on destination city and weight.</span>
            </div>
            <button
              className="btn btn-primary btn-sm rounded-pill px-3 py-1.5 text-xs font-bold shadow-sm"
              onClick={() => {
                setEditingRule(null);
                setRuleFormData({
                  origin_city: 'Addis Ababa',
                  destination_city: '',
                  delivery_method: 'ALL',
                  base_fee: '150.00',
                  per_kg_fee: '30.00',
                  estimated_days_min: 1,
                  estimated_days_max: 3,
                  is_active: true,
                });
                setRuleModalOpen(true);
              }}
            >
              <i className="bi bi-plus-circle me-1"></i> Add Fee Rule
            </button>
          </div>

          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 text-sm">
              <thead className="table-light text-slate-600 text-xs text-uppercase">
                <tr>
                  <th className="ps-4">Route Corridor</th>
                  <th>Applicable Method</th>
                  <th>Base Delivery Fee</th>
                  <th>Per Additional Kg Rate</th>
                  <th>Estimated Delivery Window</th>
                  <th>Status</th>
                  <th className="text-end pe-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingRules ? (
                  <tr>
                    <td colSpan="7" className="text-center py-4 text-muted">Loading fee rules...</td>
                  </tr>
                ) : feeRules.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-4 text-muted">No regional fee rules defined.</td>
                  </tr>
                ) : (
                  feeRules.map((r) => (
                    <tr key={r.id}>
                      <td className="ps-4">
                        <span className="fw-bold text-slate-800">{r.origin_city}</span>
                        <i className="bi bi-arrow-right mx-2 text-primary"></i>
                        <span className="fw-bold text-slate-900">{r.destination_city}</span>
                      </td>
                      <td>
                        <span className="badge bg-light text-slate-700 border text-xs">{r.delivery_method}</span>
                      </td>
                      <td>
                        <span className="fw-bold text-slate-900">{formatETB(r.base_fee)}</span>
                      </td>
                      <td>
                        <span className="text-muted">{formatETB(r.per_kg_fee)} / kg</span>
                      </td>
                      <td>
                        <span className="badge bg-slate-100 text-slate-800 border">
                          {r.estimated_days_min} &ndash; {r.estimated_days_max} business days
                        </span>
                      </td>
                      <td>
                        {r.is_active ? (
                          <span className="badge bg-success-subtle text-success border px-2 py-0.5 text-xs">Active</span>
                        ) : (
                          <span className="badge bg-secondary-subtle text-secondary border px-2 py-0.5 text-xs">Inactive</span>
                        )}
                      </td>
                      <td className="text-end pe-4">
                        <button
                          className="btn btn-outline-secondary btn-sm rounded-pill px-2.5 py-1 text-xs"
                          onClick={() => {
                            setEditingRule(r);
                            setRuleFormData({
                              origin_city: r.origin_city,
                              destination_city: r.destination_city,
                              delivery_method: r.delivery_method,
                              base_fee: r.base_fee,
                              per_kg_fee: r.per_kg_fee,
                              estimated_days_min: r.estimated_days_min,
                              estimated_days_max: r.estimated_days_max,
                              is_active: r.is_active,
                            });
                            setRuleModalOpen(true);
                          }}
                        >
                          <i className="bi bi-pencil"></i> Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 5: GLOBAL SHIPMENTS */}
      {/* ============================================================== */}
      {activeTab === 'shipments' && (
        <div className="card border-0 shadow-sm rounded-4 overflow-hidden border border-slate-200">
          <div className="card-header bg-white py-3 px-4 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
            <div>
              <h5 className="fw-bold mb-0 text-slate-800">All System Shipments Monitor</h5>
              <span className="text-muted text-xs">Real-time status overview across all orders, couriers, and own fleet deliveries.</span>
            </div>
            <div className="input-group" style={{ maxWidth: '300px' }}>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Search tracking / order..."
                value={shipmentSearch}
                onChange={(e) => setShipmentSearch(e.target.value)}
              />
              <button className="btn btn-outline-secondary btn-sm" onClick={fetchShipments}>
                <i className="bi bi-search"></i>
              </button>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 text-sm">
              <thead className="table-light text-slate-600 text-xs text-uppercase">
                <tr>
                  <th className="ps-4">Tracking Code & Order</th>
                  <th>Recipient & Destination</th>
                  <th>Method & Carrier</th>
                  <th>Current Milestone Status</th>
                  <th>Created Date</th>
                  <th className="text-end pe-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {loadingShipments ? (
                  <tr>
                    <td colSpan="6" className="text-center py-4 text-muted">Loading shipments...</td>
                  </tr>
                ) : shipments.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-4 text-muted">No shipments found.</td>
                  </tr>
                ) : (
                  shipments.map((s) => (
                    <tr key={s.id}>
                      <td className="ps-4">
                        <span className="fw-bold text-primary font-mono">{s.tracking_number}</span>
                        <div className="text-muted text-xs">Order #{s.order_number}</div>
                      </td>
                      <td>
                        <div className="fw-semibold text-slate-800">{s.recipient_name}</div>
                        <div className="text-muted text-xs"><i className="bi bi-geo-alt me-1 text-primary"></i>{s.destination_city}</div>
                      </td>
                      <td>
                        <span className="badge bg-light text-slate-700 border text-xs">{s.delivery_method_display}</span>
                        {s.courier_name && <div className="text-xs text-muted mt-1">{s.courier_name}</div>}
                        {s.vehicle_plate && <div className="text-xs text-muted mt-1">Fleet: {s.vehicle_plate}</div>}
                      </td>
                      <td>
                        <span className={`badge px-2.5 py-1 text-xs ${s.status === 'DELIVERED' ? 'bg-success-subtle text-success border border-success-subtle' : s.status === 'OUT_FOR_DELIVERY' ? 'bg-primary text-white' : 'bg-warning-subtle text-warning border border-warning-subtle'}`}>
                          {s.status_display}
                        </span>
                      </td>
                      <td className="text-muted text-xs">
                        {new Date(s.created_at).toLocaleDateString()}
                      </td>
                      <td className="text-end pe-4">
                        <a
                          href={`/track-order?tracking_number=${s.tracking_number}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-outline-primary btn-sm rounded-pill px-2.5 py-1 text-xs"
                        >
                          <i className="bi bi-eye"></i> Track
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 6: DELIVERY COMPLAINTS */}
      {/* ============================================================== */}
      {activeTab === 'complaints' && (
        <div className="card border-0 shadow-sm rounded-4 overflow-hidden border border-slate-200">
          <div className="card-header bg-white py-3 px-4 d-flex justify-content-between align-items-center">
            <div>
              <h5 className="fw-bold mb-0 text-slate-800">Customer Delivery Complaints & Disputes</h5>
              <span className="text-muted text-xs">Investigate reports of damaged items, delays, missing packages, or handover issues.</span>
            </div>
            <button className="btn btn-outline-secondary btn-sm rounded-pill px-3 py-1 text-xs" onClick={fetchComplaints}>
              <i className="bi bi-arrow-clockwise me-1"></i> Refresh
            </button>
          </div>

          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 text-sm">
              <thead className="table-light text-slate-600 text-xs text-uppercase">
                <tr>
                  <th className="ps-4">Complaint ID & Tracking</th>
                  <th>Customer & Order</th>
                  <th>Complaint Reason</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th className="text-end pe-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {loadingComplaints ? (
                  <tr>
                    <td colSpan="6" className="text-center py-4 text-muted">Loading complaints...</td>
                  </tr>
                ) : complaints.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-4 text-muted">No active customer delivery complaints. All deliveries verified!</td>
                  </tr>
                ) : (
                  complaints.map((comp) => (
                    <tr key={comp.id}>
                      <td className="ps-4">
                        <span className="fw-bold text-danger">#{comp.id}</span>
                        <div className="font-mono text-primary text-xs">{comp.tracking_number}</div>
                      </td>
                      <td>
                        <div className="fw-bold text-slate-800">{comp.customer_name}</div>
                        <div className="text-muted text-xs">Order #{comp.order_number}</div>
                      </td>
                      <td>
                        <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1 text-xs">
                          {comp.complaint_type_display}
                        </span>
                      </td>
                      <td style={{ maxWidth: '280px' }} className="text-truncate">
                        {comp.description}
                        {comp.resolution_notes && (
                          <div className="text-success text-xs mt-1">
                            <strong>Resolution:</strong> {comp.resolution_notes}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`badge px-2 py-1 text-xs ${comp.status === 'RESOLVED' ? 'bg-success-subtle text-success border border-success-subtle' : comp.status === 'OPEN' ? 'bg-danger-subtle text-danger border border-danger-subtle' : 'bg-warning-subtle text-warning border border-warning-subtle'}`}>
                          {comp.status_display}
                        </span>
                      </td>
                      <td className="text-end pe-4">
                        <button
                          className="btn btn-outline-primary btn-sm rounded-pill px-3 py-1 text-xs"
                          onClick={() => {
                            setSelectedComplaint(comp);
                            setResolutionStatus(comp.status === 'OPEN' ? 'RESOLVED' : comp.status);
                            setResolutionNotes(comp.resolution_notes || '');
                            setResolveModalOpen(true);
                          }}
                        >
                          <i className="bi bi-shield-exclamation me-1"></i> Investigate
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: ADD / EDIT COURIER COMPANY */}
      {/* ============================================================== */}
      {courierModalOpen && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content rounded-4 border-0 shadow">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold text-slate-900">
                  {editingCourier ? 'Edit Courier Partner' : 'Register Third-Party Courier Partner'}
                </h5>
                <button type="button" className="btn-close" onClick={() => setCourierModalOpen(false)}></button>
              </div>
              <form onSubmit={handleSaveCourier}>
                <div className="modal-body text-sm">
                  <div className="row g-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Company Name *</label>
                      <input
                        type="text"
                        className="form-control"
                        required
                        value={courierFormData.name}
                        onChange={(e) => setCourierFormData({ ...courierFormData, name: e.target.value })}
                        placeholder="e.g. ABC Express Ethiopia"
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Company Code * (Unique Identifier)</label>
                      <input
                        type="text"
                        className="form-control font-mono"
                        required
                        disabled={!!editingCourier}
                        value={courierFormData.code}
                        onChange={(e) => setCourierFormData({ ...courierFormData, code: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                        placeholder="e.g. ABC_EXPRESS"
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Contact Person *</label>
                      <input
                        type="text"
                        className="form-control"
                        required
                        value={courierFormData.contact_person}
                        onChange={(e) => setCourierFormData({ ...courierFormData, contact_person: e.target.value })}
                        placeholder="Key account logistics manager"
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Phone Number *</label>
                      <input
                        type="text"
                        className="form-control"
                        required
                        value={courierFormData.phone_number}
                        onChange={(e) => setCourierFormData({ ...courierFormData, phone_number: e.target.value })}
                        placeholder="+251 91 123 4567"
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Email *</label>
                      <input
                        type="email"
                        className="form-control"
                        required
                        value={courierFormData.email}
                        onChange={(e) => setCourierFormData({ ...courierFormData, email: e.target.value })}
                        placeholder="operations@courier.et"
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Origin City Hub</label>
                      <input
                        type="text"
                        className="form-control"
                        value={courierFormData.origin_city}
                        onChange={(e) => setCourierFormData({ ...courierFormData, origin_city: e.target.value })}
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-semibold">Supported Destination Cities (Comma-separated) *</label>
                      <textarea
                        className="form-control"
                        rows="2"
                        required
                        value={courierFormData.supported_destination_cities}
                        onChange={(e) => setCourierFormData({ ...courierFormData, supported_destination_cities: e.target.value })}
                        placeholder="Bahir Dar, Hawassa, Adama, Mekelle, Dire Dawa, Gondar"
                      />
                      <div className="form-text text-xs">List all regional cities where this courier maintains branches or delivery stations.</div>
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-semibold">Office Address & Branch Details</label>
                      <input
                        type="text"
                        className="form-control"
                        value={courierFormData.office_address}
                        onChange={(e) => setCourierFormData({ ...courierFormData, office_address: e.target.value })}
                        placeholder="Bole Subcity, Commercial Hub 2nd Floor, Addis Ababa"
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-semibold">External Live Tracking URL Template (Optional)</label>
                      <input
                        type="text"
                        className="form-control font-mono"
                        value={courierFormData.tracking_url_template}
                        onChange={(e) => setCourierFormData({ ...courierFormData, tracking_url_template: e.target.value })}
                        placeholder="https://track.courier.et/{tracking_number}"
                      />
                    </div>
                    <div className="col-12">
                      <div className="form-check form-switch mt-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="courierActiveSwitch"
                          checked={courierFormData.is_active}
                          onChange={(e) => setCourierFormData({ ...courierFormData, is_active: e.target.checked })}
                        />
                        <label className="form-check-label fw-semibold" htmlFor="courierActiveSwitch">
                          Active Courier Partner (Available for shipment assignments)
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-0 pt-0">
                  <button type="button" className="btn btn-light rounded-pill px-4 text-xs font-bold" onClick={() => setCourierModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary rounded-pill px-4 text-xs font-bold">
                    {editingCourier ? 'Save Changes' : 'Register Courier'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: COURIER PERFORMANCE */}
      {/* ============================================================== */}
      {perfModalOpen && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 border-0 shadow">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold text-slate-900">
                  <i className="bi bi-graph-up text-primary me-2"></i> Courier Delivery Performance
                </h5>
                <button type="button" className="btn-close" onClick={() => setPerfModalOpen(false)}></button>
              </div>
              <div className="modal-body text-sm">
                {loadingPerf || !perfData ? (
                  <div className="text-center py-4"><div className="spinner-border spinner-border-sm me-2"></div> Loading analytics...</div>
                ) : (
                  <div>
                    <h6 className="fw-bold text-slate-800 mb-1">{perfData.company_name}</h6>
                    <span className="badge bg-slate-100 text-slate-700 font-mono text-xs mb-3">{perfData.company_code}</span>

                    <div className="row g-2 mb-3">
                      <div className="col-6">
                        <div className="p-3 bg-light rounded-3 text-center border">
                          <div className="text-muted text-xs">Total Assigned</div>
                          <div className="h4 fw-bolder text-slate-900 mb-0">{perfData.total_shipments}</div>
                        </div>
                      </div>
                      <div className="col-6">
                        <div className="p-3 bg-success-subtle rounded-3 text-center border border-success-subtle">
                          <div className="text-success text-xs font-bold">Successfully Delivered</div>
                          <div className="h4 fw-bolder text-success mb-0">{perfData.delivered_shipments}</div>
                        </div>
                      </div>
                      <div className="col-6">
                        <div className="p-3 bg-primary-subtle rounded-3 text-center border border-primary-subtle">
                          <div className="text-primary text-xs font-bold">In Transit / At Station</div>
                          <div className="h4 fw-bolder text-primary mb-0">{perfData.in_transit_shipments}</div>
                        </div>
                      </div>
                      <div className="col-6">
                        <div className="p-3 bg-warning-subtle rounded-3 text-center border border-warning-subtle">
                          <div className="text-warning text-xs font-bold">Delayed / Disputed</div>
                          <div className="h4 fw-bolder text-warning mb-0">{perfData.delayed_or_failed_shipments}</div>
                        </div>
                      </div>
                    </div>

                    <div className="card p-3 border rounded-3 bg-slate-50">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <span className="fw-semibold text-slate-700">Delivery Success Rate:</span>
                        <span className="fw-bolder text-success">{perfData.delivery_success_rate_percent}%</span>
                      </div>
                      <div className="progress" style={{ height: '8px' }}>
                        <div
                          className="progress-bar bg-success"
                          role="progressbar"
                          style={{ width: `${perfData.delivery_success_rate_percent}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer border-0 pt-0">
                <button type="button" className="btn btn-secondary btn-sm rounded-pill px-4" onClick={() => setPerfModalOpen(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: ADD / EDIT VEHICLE */}
      {/* ============================================================== */}
      {vehicleModalOpen && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 border-0 shadow">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold text-slate-900">
                  {editingVehicle ? 'Edit Fleet Vehicle' : 'Register Delivery Vehicle'}
                </h5>
                <button type="button" className="btn-close" onClick={() => setVehicleModalOpen(false)}></button>
              </div>
              <form onSubmit={handleSaveVehicle}>
                <div className="modal-body text-sm">
                  <div className="row g-3">
                    <div className="col-12">
                      <label className="form-label fw-semibold">Plate Registration Number *</label>
                      <input
                        type="text"
                        className="form-control font-mono"
                        required
                        value={vehicleFormData.registration_number}
                        onChange={(e) => setVehicleFormData({ ...vehicleFormData, registration_number: e.target.value.toUpperCase() })}
                        placeholder="e.g. AA-3-98214"
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label fw-semibold">Vehicle Type *</label>
                      <select
                        className="form-select"
                        value={vehicleFormData.vehicle_type}
                        onChange={(e) => setVehicleFormData({ ...vehicleFormData, vehicle_type: e.target.value })}
                      >
                        <option value="MOTORCYCLE">Motorcycle</option>
                        <option value="CAR">Car</option>
                        <option value="VAN">Van</option>
                        <option value="TRUCK">Truck</option>
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label fw-semibold">Vehicle Model *</label>
                      <input
                        type="text"
                        className="form-control"
                        required
                        value={vehicleFormData.model}
                        onChange={(e) => setVehicleFormData({ ...vehicleFormData, model: e.target.value })}
                        placeholder="e.g. Toyota HiAce 2022"
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label fw-semibold">Primary Driver Name</label>
                      <input
                        type="text"
                        className="form-control"
                        value={vehicleFormData.driver_name}
                        onChange={(e) => setVehicleFormData({ ...vehicleFormData, driver_name: e.target.value })}
                        placeholder="Driver full name"
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label fw-semibold">Driver Contact Phone</label>
                      <input
                        type="text"
                        className="form-control"
                        value={vehicleFormData.driver_phone}
                        onChange={(e) => setVehicleFormData({ ...vehicleFormData, driver_phone: e.target.value })}
                        placeholder="+251 91 123 4567"
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label fw-semibold">Current Operating City</label>
                      <input
                        type="text"
                        className="form-control"
                        value={vehicleFormData.current_city}
                        onChange={(e) => setVehicleFormData({ ...vehicleFormData, current_city: e.target.value })}
                        placeholder="Addis Ababa"
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label fw-semibold">Operational Status</label>
                      <select
                        className="form-select"
                        value={vehicleFormData.status}
                        onChange={(e) => setVehicleFormData({ ...vehicleFormData, status: e.target.value })}
                      >
                        <option value="AVAILABLE">Available</option>
                        <option value="IN_USE">In Use / Dispatched</option>
                        <option value="MAINTENANCE">Maintenance</option>
                        <option value="INACTIVE">Inactive</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-0 pt-0">
                  <button type="button" className="btn btn-light rounded-pill px-4 text-xs font-bold" onClick={() => setVehicleModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary rounded-pill px-4 text-xs font-bold">
                    Save Vehicle
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 4: ADD / EDIT PERSONNEL */}
      {/* ============================================================== */}
      {personnelModalOpen && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 border-0 shadow">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold text-slate-900">
                  {editingPersonnel ? 'Edit Delivery Personnel' : 'Register Delivery Personnel'}
                </h5>
                <button type="button" className="btn-close" onClick={() => setPersonnelModalOpen(false)}></button>
              </div>
              <form onSubmit={handleSavePersonnel}>
                <div className="modal-body text-sm">
                  <div className="row g-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Full Name *</label>
                      <input
                        type="text"
                        className="form-control"
                        required
                        value={personnelFormData.full_name}
                        onChange={(e) => setPersonnelFormData({ ...personnelFormData, full_name: e.target.value })}
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Employee Code *</label>
                      <input
                        type="text"
                        className="form-control font-mono"
                        required
                        disabled={!!editingPersonnel}
                        value={personnelFormData.employee_code}
                        onChange={(e) => setPersonnelFormData({ ...personnelFormData, employee_code: e.target.value.toUpperCase() })}
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Phone Number *</label>
                      <input
                        type="text"
                        className="form-control"
                        required
                        value={personnelFormData.phone_number}
                        onChange={(e) => setPersonnelFormData({ ...personnelFormData, phone_number: e.target.value })}
                        placeholder="+251 91 123 4567"
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Email Address</label>
                      <input
                        type="email"
                        className="form-control"
                        value={personnelFormData.email}
                        onChange={(e) => setPersonnelFormData({ ...personnelFormData, email: e.target.value })}
                        placeholder="driver@ethiotechmarket.com"
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Vehicle Type</label>
                      <select
                        className="form-select"
                        value={personnelFormData.vehicle_type}
                        onChange={(e) => setPersonnelFormData({ ...personnelFormData, vehicle_type: e.target.value })}
                      >
                        <option value="Motorcycle">Motorcycle / Scooter</option>
                        <option value="Van">Delivery Van</option>
                        <option value="Pickup">Pickup Truck</option>
                        <option value="Bicycle">Bicycle / Courier on Foot</option>
                      </select>
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Vehicle Plate / Registration</label>
                      <input
                        type="text"
                        className="form-control font-mono"
                        value={personnelFormData.vehicle_registration_number}
                        onChange={(e) => setPersonnelFormData({ ...personnelFormData, vehicle_registration_number: e.target.value })}
                        placeholder="AA-3-44556"
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Assigned Delivery Area / Zone</label>
                      <input
                        type="text"
                        className="form-control"
                        value={personnelFormData.delivery_area}
                        onChange={(e) => setPersonnelFormData({ ...personnelFormData, delivery_area: e.target.value })}
                        placeholder="e.g. Addis Ababa Central Zone, Bole"
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Courier Status</label>
                      <select
                        className="form-select"
                        value={personnelFormData.status}
                        onChange={(e) => setPersonnelFormData({ ...personnelFormData, status: e.target.value })}
                      >
                        <option value="ACTIVE">ACTIVE (Authorized for deliveries)</option>
                        <option value="INACTIVE">INACTIVE</option>
                        <option value="ON_LEAVE">ON_LEAVE</option>
                        <option value="SUSPENDED">SUSPENDED</option>
                      </select>
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Delivery Scope / Method</label>
                      <select
                        className="form-select"
                        value={personnelFormData.delivery_method}
                        onChange={(e) => setPersonnelFormData({ ...personnelFormData, delivery_method: e.target.value })}
                      >
                        <option value="OWN_FLEET">Own Fleet Delivery</option>
                        <option value="THIRD_PARTY_LOCAL">Third-Party Local Partner</option>
                      </select>
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-semibold">Current Operating City</label>
                      <input
                        type="text"
                        className="form-control"
                        value={personnelFormData.current_city}
                        onChange={(e) => setPersonnelFormData({ ...personnelFormData, current_city: e.target.value })}
                        placeholder="Addis Ababa or Bahir Dar"
                      />
                    </div>
                    {personnelFormData.delivery_method === 'THIRD_PARTY_LOCAL' && (
                      <div className="col-12">
                        <label className="form-label fw-semibold">Associated Courier Partner</label>
                        <select
                          className="form-select"
                          value={personnelFormData.courier_company}
                          onChange={(e) => setPersonnelFormData({ ...personnelFormData, courier_company: e.target.value })}
                        >
                          <option value="">Select courier company...</option>
                          {couriers.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="col-12">
                      <div className="form-check form-switch mt-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="personnelAvailSwitch"
                          checked={personnelFormData.is_available}
                          onChange={(e) => setPersonnelFormData({ ...personnelFormData, is_available: e.target.checked })}
                        />
                        <label className="form-check-label fw-semibold" htmlFor="personnelAvailSwitch">
                          Available for shipment assignments and OTP customer handovers
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-0 pt-0">
                  <button type="button" className="btn btn-light rounded-pill px-4 text-xs font-bold" onClick={() => setPersonnelModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary rounded-pill px-4 text-xs font-bold">
                    Save Personnel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 5: ADD / EDIT FEE RULE */}
      {/* ============================================================== */}
      {ruleModalOpen && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 border-0 shadow">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold text-slate-900">
                  {editingRule ? 'Edit Fee Rule' : 'Add Regional Delivery Fee Rule'}
                </h5>
                <button type="button" className="btn-close" onClick={() => setRuleModalOpen(false)}></button>
              </div>
              <form onSubmit={handleSaveRule}>
                <div className="modal-body text-sm">
                  <div className="row g-3">
                    <div className="col-6">
                      <label className="form-label fw-semibold">Origin City</label>
                      <input
                        type="text"
                        className="form-control"
                        required
                        value={ruleFormData.origin_city}
                        onChange={(e) => setRuleFormData({ ...ruleFormData, origin_city: e.target.value })}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label fw-semibold">Destination City *</label>
                      <input
                        type="text"
                        className="form-control"
                        required
                        value={ruleFormData.destination_city}
                        onChange={(e) => setRuleFormData({ ...ruleFormData, destination_city: e.target.value })}
                        placeholder="e.g. Bahir Dar"
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-semibold">Delivery Method</label>
                      <select
                        className="form-select"
                        value={ruleFormData.delivery_method}
                        onChange={(e) => setRuleFormData({ ...ruleFormData, delivery_method: e.target.value })}
                      >
                        <option value="ALL">All Methods</option>
                        <option value="THIRD_PARTY_COURIER">Third-Party Courier</option>
                        <option value="OWN_DELIVERY">Own Delivery Service</option>
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label fw-semibold">Base Delivery Fee (ETB) *</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        required
                        value={ruleFormData.base_fee}
                        onChange={(e) => setRuleFormData({ ...ruleFormData, base_fee: e.target.value })}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label fw-semibold">Per Kg Rate (ETB) *</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        required
                        value={ruleFormData.per_kg_fee}
                        onChange={(e) => setRuleFormData({ ...ruleFormData, per_kg_fee: e.target.value })}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label fw-semibold">Min Days ETA</label>
                      <input
                        type="number"
                        className="form-control"
                        required
                        value={ruleFormData.estimated_days_min}
                        onChange={(e) => setRuleFormData({ ...ruleFormData, estimated_days_min: parseInt(e.target.value) || 1 })}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label fw-semibold">Max Days ETA</label>
                      <input
                        type="number"
                        className="form-control"
                        required
                        value={ruleFormData.estimated_days_max}
                        onChange={(e) => setRuleFormData({ ...ruleFormData, estimated_days_max: parseInt(e.target.value) || 3 })}
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-0 pt-0">
                  <button type="button" className="btn btn-light rounded-pill px-4 text-xs font-bold" onClick={() => setRuleModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary rounded-pill px-4 text-xs font-bold">
                    Save Fee Rule
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 6: RESOLVE COMPLAINT */}
      {/* ============================================================== */}
      {resolveModalOpen && selectedComplaint && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 border-0 shadow">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold text-slate-900">
                  <i className="bi bi-shield-check text-success me-2"></i> Investigate Delivery Complaint
                </h5>
                <button type="button" className="btn-close" onClick={() => setResolveModalOpen(false)}></button>
              </div>
              <form onSubmit={handleResolveComplaint}>
                <div className="modal-body text-sm">
                  <div className="p-3 bg-light rounded-3 mb-3 border">
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-muted text-xs">Customer:</span>
                      <span className="fw-bold text-slate-800">{selectedComplaint.customer_name}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-muted text-xs">Tracking Number:</span>
                      <span className="font-mono text-primary fw-bold">{selectedComplaint.tracking_number}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-muted text-xs">Complaint Type:</span>
                      <span className="badge bg-danger-subtle text-danger">{selectedComplaint.complaint_type_display}</span>
                    </div>
                    <div className="mt-2 text-slate-700 bg-white p-2.5 rounded border text-xs">
                      "{selectedComplaint.description}"
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Investigation Decision Status *</label>
                    <select
                      className="form-select"
                      value={resolutionStatus}
                      onChange={(e) => setResolutionStatus(e.target.value)}
                    >
                      <option value="UNDER_INVESTIGATION">Under Investigation (Courier Contacted)</option>
                      <option value="RESOLVED">Resolved (Settled with Customer)</option>
                      <option value="REJECTED">Rejected (Delivery Proven by OTP)</option>
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Resolution Notes & Actions Taken *</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      required
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      placeholder="e.g. Verified with ABC Express Bahir Dar branch. Replaced damaged outer box, issued customer compensation voucher."
                    />
                  </div>
                </div>
                <div className="modal-footer border-0 pt-0">
                  <button type="button" className="btn btn-light rounded-pill px-4 text-xs font-bold" onClick={() => setResolveModalOpen(false)}>
                    Close
                  </button>
                  <button type="submit" className="btn btn-primary rounded-pill px-4 text-xs font-bold">
                    Save Resolution
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

export default AdminDeliveryHubPage;
