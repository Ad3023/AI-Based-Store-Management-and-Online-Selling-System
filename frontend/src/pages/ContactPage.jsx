import React, { useState } from 'react';

const ContactPage = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: 'General Inquiry',
    message: '',
  });

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
      setFormData({ name: '', email: '', phone: '', subject: 'General Inquiry', message: '' });
    }, 800);
  };

  return (
    <div className="container py-5">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto mb-5">
        <span className="badge bg-primary bg-opacity-10 text-primary rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider mb-2">
          <i className="bi bi-headset me-1"></i> Customer Support & Inquiries
        </span>
        <h1 className="display-6 fw-bolder text-slate-900 mb-2">Contact NexusStore AI</h1>
        <p className="text-slate-500 text-sm">
          Have questions about your order, bank payment verification, or product specifications? We're here to help.
        </p>
      </div>

      <div className="row g-5">
        {/* Contact Info Cards */}
        <div className="col-lg-5">
          <div className="d-flex flex-column gap-3 mb-4">
            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white border border-slate-100">
              <div className="d-flex align-items-center gap-3">
                <div
                  className="rounded-2xl p-3 d-flex align-items-center justify-content-center text-white"
                  style={{ width: '48px', height: '48px', background: 'var(--gradient-primary)' }}
                >
                  <i className="bi bi-geo-alt-fill fs-5"></i>
                </div>
                <div>
                  <h6 className="fw-bold mb-0 text-slate-900">Addis Ababa Headquarters</h6>
                  <p className="text-slate-500 text-xs mb-0">Bole Subcity, Woreda 03, Addis Ababa, Ethiopia</p>
                </div>
              </div>
            </div>

            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white border border-slate-100">
              <div className="d-flex align-items-center gap-3">
                <div
                  className="rounded-2xl p-3 d-flex align-items-center justify-content-center text-white bg-success"
                  style={{ width: '48px', height: '48px' }}
                >
                  <i className="bi bi-telephone-fill fs-5"></i>
                </div>
                <div>
                  <h6 className="fw-bold mb-0 text-slate-900">Phone Support</h6>
                  <p className="text-slate-500 text-xs mb-0">+251 911 223 344 &bull; +251 116 554 433</p>
                  <small className="text-slate-400 text-[10px]">Mon-Sat: 8:30 AM - 6:30 PM (EAT)</small>
                </div>
              </div>
            </div>

            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white border border-slate-100">
              <div className="d-flex align-items-center gap-3">
                <div
                  className="rounded-2xl p-3 d-flex align-items-center justify-content-center text-white bg-info"
                  style={{ width: '48px', height: '48px' }}
                >
                  <i className="bi bi-envelope-fill fs-5"></i>
                </div>
                <div>
                  <h6 className="fw-bold mb-0 text-slate-900">Email & Inquiries</h6>
                  <p className="text-slate-500 text-xs mb-0">support@nexusstore.ai &bull; sales@nexusstore.ai</p>
                  <small className="text-slate-400 text-[10px]">Average response under 2 hours</small>
                </div>
              </div>
            </div>

            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white border border-slate-100">
              <div className="d-flex align-items-center gap-3">
                <div
                  className="rounded-2xl p-3 d-flex align-items-center justify-content-center text-white bg-purple-600"
                  style={{ width: '48px', height: '48px', background: '#7c3aed' }}
                >
                  <i className="bi bi-telegram fs-5"></i>
                </div>
                <div>
                  <h6 className="fw-bold mb-0 text-slate-900">Telegram Bot Channel</h6>
                  <p className="text-slate-500 text-xs mb-0">@NexusStoreAIBot &bull; Instant order status checks</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Form */}
        <div className="col-lg-7">
          <div className="card border-0 shadow-lg rounded-4 p-4 p-md-5 bg-white">
            <h4 className="fw-bolder text-slate-900 mb-1">Send us a Message</h4>
            <p className="text-slate-500 text-xs mb-4">
              Fill in the form below and our store management team will reply promptly.
            </p>

            {submitted && (
              <div className="alert alert-success rounded-3 small mb-4 d-flex align-items-center gap-2">
                <i className="bi bi-check-circle-fill fs-5"></i>
                <div>
                  <strong>Message Sent Successfully!</strong> Thank you for reaching out. A store representative will contact you via email or phone.
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label text-xs fw-bold text-slate-700">Full Name *</label>
                  <input
                    type="text"
                    name="name"
                    className="form-control text-sm py-2.5"
                    placeholder="e.g. Abebe Bikila"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label text-xs fw-bold text-slate-700">Email Address *</label>
                  <input
                    type="email"
                    name="email"
                    className="form-control text-sm py-2.5"
                    placeholder="name@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label text-xs fw-bold text-slate-700">Phone Number</label>
                  <input
                    type="tel"
                    name="phone"
                    className="form-control text-sm py-2.5"
                    placeholder="+251 9..."
                    value={formData.phone}
                    onChange={handleChange}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label text-xs fw-bold text-slate-700">Inquiry Subject</label>
                  <select
                    name="subject"
                    className="form-select text-sm py-2.5"
                    value={formData.subject}
                    onChange={handleChange}
                  >
                    <option value="General Inquiry">General Inquiry</option>
                    <option value="Payment Verification">Payment Evidence / Verification</option>
                    <option value="Chapa Payment">Chapa Payment Question</option>
                    <option value="Shipping Delivery">Shipping & Regional Delivery</option>
                    <option value="Warranty Return">Warranty & Returns</option>
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label text-xs fw-bold text-slate-700">Message Content *</label>
                <textarea
                  name="message"
                  className="form-control text-sm"
                  rows="4"
                  placeholder="How can our store team assist you today?"
                  value={formData.message}
                  onChange={handleChange}
                  required
                ></textarea>
              </div>

              <button
                type="submit"
                className="btn btn-primary-gradient rounded-full px-5 py-2.5 font-bold text-xs shadow-md"
                disabled={loading}
              >
                {loading ? 'Sending Message...' : 'Submit Message'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
