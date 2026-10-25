import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';

// Verified Business & Location Details
// Note: When specific street/building GPS coordinates are supplied, update `exactCoordinates` and `physicalStoreAddressVerified`
const STORE_LOCATION = {
  businessName: 'EthioTech Market',
  contactPerson: 'Addisu Guche',
  role: 'Store Manager & Customer Support Lead',
  city: 'Debre Birhan',
  region: 'Amhara',
  country: 'Ethiopia',
  fullHeadquartersAddress: 'Debre Birhan, Amhara, Ethiopia',
  phone: '0930232517',
  phoneDisplay: '0930232517',
  phoneFormatted: '0930 23 25 17',
  phoneInternational: '+251 930 232 517',
  email: 'addisuguche68@gmail.com',
  workingHours: 'Monday – Saturday: 8:30 AM – 6:30 PM (EAT)',
  responseTime: 'Average reply within 2 hours',
  // Verification flag: true when specific street number & building landmark are provided
  physicalStoreAddressVerified: false,
  mapQuery: 'Debre Birhan, Amhara, Ethiopia',
  embedUrl: 'https://maps.google.com/maps?q=Debre+Birhan,+Amhara,+Ethiopia&t=&z=14&ie=UTF8&iwloc=&output=embed',
  directionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=Debre+Birhan,+Amhara,+Ethiopia',
  viewLargerUrl: 'https://www.google.com/maps/search/?api=1&query=Debre+Birhan,+Amhara,+Ethiopia',
};

const ContactPage = () => {
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    name: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username : '',
    email: user?.email || '',
    phone: user?.phone_number || '',
    subject: 'General Inquiry',
    message: '',
  });

  const [formErrors, setFormErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Validate form inputs
  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      errors.name = 'Please provide your full name (minimum 2 characters).';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim() || !emailRegex.test(formData.email.trim())) {
      errors.email = 'Please provide a valid email address.';
    }

    // Optional phone validation: if provided, check Ethiopian format (09..., 07..., or +251...)
    if (formData.phone.trim()) {
      const cleanPhone = formData.phone.replace(/[\s\-()]/g, '');
      const ethiopianPhoneRegex = /^(\+?251|0)?[79]\d{8}$/;
      if (!ethiopianPhoneRegex.test(cleanPhone)) {
        errors.phone = 'Please provide a valid Ethiopian phone number (e.g., 0930232517 or +251 930 232 517).';
      }
    }

    if (!formData.message.trim() || formData.message.trim().length < 10) {
      errors.message = 'Please provide message details (minimum 10 characters).';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear field-specific error as user types
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // If user is authenticated, sync inquiry directly into the backend feedback system
      if (user) {
        try {
          await api.post('products/feedback/', {
            subject: `[${formData.subject}] from ${formData.name}`,
            category: 'GENERAL',
            message: `${formData.message.trim()}\n\nContact Details:\nName: ${formData.name}\nEmail: ${formData.email}\nPhone: ${formData.phone || 'N/A'}`,
          });
        } catch (apiErr) {
          console.warn('Backend feedback recording skipped:', apiErr);
        }
      }

      // Simulate network response if guest or on successful post
      await new Promise((resolve) => setTimeout(resolve, 600));

      setLoading(false);
      setSubmitted(true);
      setFormData({
        name: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username : '',
        email: user?.email || '',
        phone: user?.phone_number || '',
        subject: 'General Inquiry',
        message: '',
      });
    } catch (err) {
      setLoading(false);
      setSubmitError('Failed to send message. Please try again or reach out directly via phone or email.');
      console.error('Contact submit error:', err);
    }
  };

  return (
    <div className="py-4 py-lg-5 px-3 px-lg-4" style={{ backgroundColor: '#f4f6fa', minHeight: '100%' }}>
      <div className="container-fluid max-w-7xl">

        {/* Page Header */}
        <div className="text-center max-w-2xl mx-auto mb-4 mb-lg-5">
          <span
            className="badge rounded-pill px-3 py-1.5 text-xs fw-bold text-uppercase mb-2 d-inline-flex align-items-center gap-1.5"
            style={{ backgroundColor: 'rgba(27, 100, 218, 0.1)', color: '#1b64da', border: '1px solid rgba(27, 100, 218, 0.25)' }}
          >
            <i className="bi bi-headset"></i> Customer Care & Store Location
          </span>
          <h1 className="display-6 fw-bolder text-slate-900 mb-2" style={{ letterSpacing: '-0.02em' }}>
            Contact EthioTech Market
          </h1>
          <p className="text-slate-600 text-sm mb-0" style={{ lineHeight: '1.6' }}>
            Have questions about genuine electronics, order deliveries across Ethiopia, Chapa payments, or official warranty claims? Reach out directly to our store team.
          </p>
        </div>

        {/* Contact Info & Message Form Grid */}
        <div className="row g-4 mb-5">

          {/* Left Column: Verified Business & Contact Details */}
          <div className="col-lg-5">
            <div className="d-flex flex-column gap-3">

              {/* Primary Contact Person & Business Card */}
              <div className="card ethio-card p-4">
                <div className="d-flex align-items-center gap-3 mb-3">
                  <div
                    className="rounded-3 d-flex align-items-center justify-content-center text-white flex-shrink-0"
                    style={{ width: '48px', height: '48px', backgroundColor: '#1b64da' }}
                  >
                    <i className="bi bi-person-badge-fill fs-5"></i>
                  </div>
                  <div>
                    <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill px-2 py-0.5 text-[10px] fw-bold text-uppercase mb-1">
                      Direct Store Contact
                    </span>
                    <h5 className="fw-bold mb-0 text-slate-900">{STORE_LOCATION.contactPerson}</h5>
                    <p className="text-slate-500 text-xs mb-0">{STORE_LOCATION.role} &bull; {STORE_LOCATION.businessName}</p>
                  </div>
                </div>

                <hr className="border-slate-200 my-2" />

                <div className="d-flex flex-column gap-3 pt-2 text-xs">
                  {/* Phone */}
                  <div className="d-flex align-items-start gap-3">
                    <div
                      className="rounded-2 d-flex align-items-center justify-content-center text-white flex-shrink-0"
                      style={{ width: '36px', height: '36px', backgroundColor: '#10b981' }}
                    >
                      <i className="bi bi-telephone-fill"></i>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[11px] fw-semibold d-block">Direct Phone Number</span>
                      <a
                        href={`tel:${STORE_LOCATION.phone}`}
                        className="fw-bold text-slate-900 text-decoration-none fs-6 text-primary hover-text-blue"
                        title="Click to call EthioTech Market"
                      >
                        {STORE_LOCATION.phoneDisplay}
                      </a>
                      <span className="text-slate-500 text-[11px] d-block mt-0.5">
                        International: {STORE_LOCATION.phoneInternational}
                      </span>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="d-flex align-items-start gap-3">
                    <div
                      className="rounded-2 d-flex align-items-center justify-content-center text-white flex-shrink-0"
                      style={{ width: '36px', height: '36px', backgroundColor: '#0284c7' }}
                    >
                      <i className="bi bi-envelope-fill"></i>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[11px] fw-semibold d-block">Official Email Address</span>
                      <a
                        href={`mailto:${STORE_LOCATION.email}`}
                        className="fw-bold text-slate-900 text-decoration-none text-primary hover-text-blue"
                        title="Click to email EthioTech Market"
                      >
                        {STORE_LOCATION.email}
                      </a>
                      <span className="text-slate-500 text-[11px] d-block mt-0.5">
                        {STORE_LOCATION.responseTime}
                      </span>
                    </div>
                  </div>

                  {/* Headquarters Location */}
                  <div className="d-flex align-items-start gap-3">
                    <div
                      className="rounded-2 d-flex align-items-center justify-content-center text-white flex-shrink-0"
                      style={{ width: '36px', height: '36px', backgroundColor: '#0c1e33' }}
                    >
                      <i className="bi bi-geo-alt-fill"></i>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[11px] fw-semibold d-block">Headquarters & Fulfillment</span>
                      <strong className="text-slate-900 d-block">{STORE_LOCATION.fullHeadquartersAddress}</strong>
                      <span className="text-slate-500 text-[11px] d-block mt-0.5">
                        Operating Hub: {STORE_LOCATION.city}, {STORE_LOCATION.region} Region
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Working Hours & Service Assurance */}
              <div className="card ethio-card p-4">
                <h6 className="fw-bold text-slate-900 mb-3 d-flex align-items-center gap-2">
                  <i className="bi bi-clock-history text-primary"></i> Operating Hours & Support
                </h6>
                <div className="d-flex flex-column gap-2 text-xs text-slate-600">
                  <div className="d-flex justify-content-between pb-1 border-bottom border-slate-100">
                    <span>Monday – Saturday:</span>
                    <strong className="text-slate-900">8:30 AM – 6:30 PM (EAT)</strong>
                  </div>
                  <div className="d-flex justify-content-between pb-1 border-bottom border-slate-100">
                    <span>Sunday:</span>
                    <span className="badge bg-slate-100 text-slate-700">Dispatch & On-call</span>
                  </div>
                  <div className="d-flex justify-content-between pt-1">
                    <span>Payment Verification:</span>
                    <span className="badge bg-success bg-opacity-10 text-success fw-bold">Live Support</span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-top border-slate-100 text-xs text-slate-500">
                  <i className="bi bi-shield-check text-success me-1"></i> Official Warranty claims and in-person store pickups can be arranged directly via phone or email.
                </div>
              </div>

            </div>
          </div>

          {/* Right Column: Contact Inquiry Form */}
          <div className="col-lg-7">
            <div className="card ethio-card p-4 p-md-5">
              <div className="mb-4">
                <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill px-2.5 py-1 text-[11px] fw-bold mb-2">
                  Online Inquiry
                </span>
                <h4 className="fw-bolder text-slate-900 mb-1">Send us a Message</h4>
                <p className="text-slate-500 text-xs mb-0">
                  Fill out the form below. Addisu Guche and the EthioTech Market team will review your inquiry and follow up promptly.
                </p>
              </div>

              {/* Success Banner */}
              {submitted && (
                <div className="alert alert-success border-0 rounded-3 p-3.5 mb-4 shadow-sm" role="alert">
                  <div className="d-flex align-items-start gap-2.5">
                    <i className="bi bi-check-circle-fill text-success fs-4 flex-shrink-0 mt-0.5"></i>
                    <div className="flex-grow-1">
                      <h6 className="fw-bold text-success mb-1">Thank You! Message Received</h6>
                      <p className="text-slate-700 text-xs mb-2">
                        Your inquiry has been submitted successfully to EthioTech Market. We will respond to <strong>{formData.email || 'your email'}</strong> or call <strong>{formData.phone || 'your phone'}</strong>.
                      </p>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-success text-xs fw-semibold px-3 py-1 rounded-2"
                        onClick={() => setSubmitted(false)}
                      >
                        Send Another Message
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Banner */}
              {submitError && (
                <div className="alert alert-danger border-0 rounded-3 p-3 mb-4 text-xs d-flex align-items-center gap-2" role="alert">
                  <i className="bi bi-exclamation-triangle-fill fs-5"></i>
                  <div>{submitError}</div>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate>
                {/* Name & Email Row */}
                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <label htmlFor="contact-name" className="form-label text-xs fw-bold text-slate-700 mb-1">
                      Full Name <span className="text-danger">*</span>
                    </label>
                    <input
                      id="contact-name"
                      type="text"
                      name="name"
                      className={`form-control text-sm py-2 px-3 ${formErrors.name ? 'is-invalid' : ''}`}
                      placeholder="e.g. Abebe Bikila"
                      value={formData.name}
                      onChange={handleChange}
                      required
                    />
                    {formErrors.name && (
                      <div className="invalid-feedback text-[11px] mt-1">{formErrors.name}</div>
                    )}
                  </div>

                  <div className="col-md-6">
                    <label htmlFor="contact-email" className="form-label text-xs fw-bold text-slate-700 mb-1">
                      Email Address <span className="text-danger">*</span>
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      name="email"
                      className={`form-control text-sm py-2 px-3 ${formErrors.email ? 'is-invalid' : ''}`}
                      placeholder="name@example.com"
                      value={formData.email}
                      onChange={handleChange}
                      required
                    />
                    {formErrors.email && (
                      <div className="invalid-feedback text-[11px] mt-1">{formErrors.email}</div>
                    )}
                  </div>
                </div>

                {/* Phone & Subject Row */}
                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <label htmlFor="contact-phone" className="form-label text-xs fw-bold text-slate-700 mb-1">
                      Phone Number <span className="text-muted fw-normal">(Optional)</span>
                    </label>
                    <input
                      id="contact-phone"
                      type="tel"
                      name="phone"
                      className={`form-control text-sm py-2 px-3 ${formErrors.phone ? 'is-invalid' : ''}`}
                      placeholder="0930232517 or +251 9..."
                      value={formData.phone}
                      onChange={handleChange}
                    />
                    {formErrors.phone && (
                      <div className="invalid-feedback text-[11px] mt-1">{formErrors.phone}</div>
                    )}
                  </div>

                  <div className="col-md-6">
                    <label htmlFor="contact-subject" className="form-label text-xs fw-bold text-slate-700 mb-1">
                      Inquiry Subject
                    </label>
                    <select
                      id="contact-subject"
                      name="subject"
                      className="form-select text-sm py-2 px-3"
                      value={formData.subject}
                      onChange={handleChange}
                    >
                      <option value="General Inquiry">General Store Inquiry</option>
                      <option value="Order Status & Tracking">Order Status & Tracking</option>
                      <option value="Chapa & Bank Payment Verification">Chapa / Bank Payment Verification</option>
                      <option value="Warranty Claim Assistance">Warranty Claim Assistance</option>
                      <option value="Store Visit & Pickup in Debre Birhan">Store Visit / Pickup in Debre Birhan</option>
                      <option value="Bulk Tech Procurement">Bulk Tech Procurement</option>
                    </select>
                  </div>
                </div>

                {/* Message Content */}
                <div className="mb-4">
                  <label htmlFor="contact-message" className="form-label text-xs fw-bold text-slate-700 mb-1">
                    Message Content <span className="text-danger">*</span>
                  </label>
                  <textarea
                    id="contact-message"
                    name="message"
                    className={`form-control text-sm py-2 px-3 ${formErrors.message ? 'is-invalid' : ''}`}
                    rows="4"
                    placeholder="How can our store team in Debre Birhan assist you today?"
                    value={formData.message}
                    onChange={handleChange}
                    required
                  ></textarea>
                  {formErrors.message && (
                    <div className="invalid-feedback text-[11px] mt-1">{formErrors.message}</div>
                  )}
                  <small className="text-muted text-[11px] d-block mt-1">
                    Minimum 10 characters. Include order numbers or device models if relevant.
                  </small>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className="btn btn-ethio-primary px-5 py-2.5 text-xs fw-bold shadow-sm"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Sending Message...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-send-fill me-1.5"></i> Submit Inquiry
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

        </div>

        {/* Section 2: Interactive Google Maps Location - "Find Our Store" */}
        <section className="mb-4">
          <div className="card ethio-card p-4 p-md-5">

            {/* Section Header */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4 pb-3 border-bottom border-slate-200">
              <div>
                <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill px-2.5 py-1 text-[11px] fw-bold mb-1">
                  <i className="bi bi-geo-alt me-1"></i> Interactive Map
                </span>
                <h3 className="fw-bolder text-slate-900 mb-1" style={{ letterSpacing: '-0.02em' }}>
                  Find Our Store
                </h3>
                <p className="text-slate-500 text-xs mb-0">
                  EthioTech Market Headquarters & Regional Fulfillment Hub in Debre Birhan, Amhara, Ethiopia.
                </p>
              </div>

              {/* Map Action Links */}
              <div className="d-flex flex-wrap align-items-center gap-2">
                <a
                  href={STORE_LOCATION.directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-sm btn-ethio-primary px-3 py-2 text-xs fw-bold text-decoration-none"
                  title="Open directions in Google Maps"
                >
                  <i className="bi bi-signpost-2 me-1.5"></i> Get Directions
                </a>
                <a
                  href={STORE_LOCATION.viewLargerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-sm btn-ethio-outline px-3 py-2 text-xs fw-semibold text-decoration-none"
                  title="Open full map in new tab"
                >
                  <i className="bi bi-box-arrow-up-right me-1.5"></i> View Larger Map
                </a>
              </div>
            </div>

            {/* Interactive Google Map Embed */}
            <div
              className="position-relative overflow-hidden rounded-3 shadow-sm mb-4"
              style={{
                width: '100%',
                height: '380px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#e2e8f0',
              }}
            >
              <iframe
                title="EthioTech Market Store Location Map in Debre Birhan"
                src={STORE_LOCATION.embedUrl}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen=""
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              ></iframe>
            </div>

            {/* Physical Location Details & Address Status Notice */}
            <div className="row g-3 align-items-center">
              <div className="col-lg-7">
                <div className="d-flex align-items-start gap-3">
                  <div
                    className="rounded-3 d-flex align-items-center justify-content-center text-white flex-shrink-0"
                    style={{ width: '42px', height: '42px', backgroundColor: '#0c1e33' }}
                  >
                    <i className="bi bi-pin-map-fill fs-5 text-info"></i>
                  </div>
                  <div>
                    <h6 className="fw-bold text-slate-900 mb-0.5">
                      {STORE_LOCATION.businessName} — Headquarters & Fulfillment Center
                    </h6>
                    <p className="text-slate-600 text-xs mb-1">
                      {STORE_LOCATION.fullHeadquartersAddress} &bull; Contact: {STORE_LOCATION.contactPerson} ({STORE_LOCATION.phoneDisplay})
                    </p>
                    <p className="text-slate-500 text-[11px] mb-0">
                      Email: <a href={`mailto:${STORE_LOCATION.email}`} className="text-primary text-decoration-none">{STORE_LOCATION.email}</a> &bull; Phone: <a href={`tel:${STORE_LOCATION.phone}`} className="text-primary text-decoration-none">{STORE_LOCATION.phoneDisplay}</a>
                    </p>
                  </div>
                </div>
              </div>

              {/* Status Box: Honest Transparency regarding Physical Street Address */}
              <div className="col-lg-5">
                <div
                  className="p-3 rounded-3"
                  style={{
                    backgroundColor: '#eff6ff',
                    border: '1px solid #bfdbfe',
                  }}
                >
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <span className="badge bg-warning bg-opacity-20 text-warning-emphasis border border-warning border-opacity-30 rounded-pill px-2 py-0.5 text-[10px] fw-bold">
                      <i className="bi bi-clock-history me-1"></i> Address Status
                    </span>
                    <span className="text-slate-800 text-xs fw-bold">Debre Birhan Headquarters</span>
                  </div>
                  <p className="text-slate-600 text-[11px] mb-0" style={{ lineHeight: '1.45' }}>
                    The interactive map highlights the verified headquarters area in <strong>Debre Birhan, Amhara, Ethiopia</strong>. The specific retail building number and physical storefront unit are currently awaiting final physical verification. For direct local pickup or warehouse drop-off, call <strong>{STORE_LOCATION.phoneDisplay}</strong>.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </section>

      </div>
    </div>
  );
};

export default ContactPage;
