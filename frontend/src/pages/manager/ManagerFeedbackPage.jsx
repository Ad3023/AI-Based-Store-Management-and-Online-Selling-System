import React, { useState, useEffect } from 'react';
import api from '../../api';

const ManagerFeedbackPage = () => {
  const [activeTab, setActiveTab] = useState('store'); // 'store' or 'reviews'
  const [feedbackList, setFeedbackList] = useState([]);
  const [reviewsList, setReviewsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alertMsg, setAlertMsg] = useState({ type: '', text: '' });

  // Response Modal State
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState('RESOLVED');
  const [submittingReply, setSubmittingReply] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [feedRes, revRes] = await Promise.all([
        api.get('products/feedback/').catch(() => ({ data: [] })),
        api.get('products/items/?limit=50').catch(() => ({ data: [] })),
      ]);

      setFeedbackList(feedRes.data.results || feedRes.data || []);

      // Extract reviews from products
      const prods = revRes.data.results || revRes.data || [];
      const allReviews = [];
      prods.forEach((p) => {
        if (p.reviews && p.reviews.length > 0) {
          p.reviews.forEach((r) => {
            allReviews.push({ ...r, productName: p.name, productId: p.id });
          });
        }
      });
      setReviewsList(allReviews);
    } catch (err) {
      console.error('Error fetching feedback data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenReplyModal = (fb) => {
    setSelectedFeedback(fb);
    setReplyText(fb.admin_response || '');
    setFeedbackStatus(fb.status || 'RESOLVED');
  };

  const handleSubmitReply = async (e) => {
    e.preventDefault();
    if (!selectedFeedback) return;
    try {
      setSubmittingReply(true);
      await api.patch(`products/feedback/${selectedFeedback.id}/`, {
        status: feedbackStatus,
        admin_response: replyText,
      });
      setSelectedFeedback(null);
      setAlertMsg({ type: 'success', text: 'Response recorded and status updated.' });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to submit response.');
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleModerateReview = async (reviewId, isApproved) => {
    try {
      await api.patch(`products/reviews/${reviewId}/moderate/`, {
        is_approved: isApproved,
      });
      setAlertMsg({
        type: 'success',
        text: `Review marked as ${isApproved ? 'Approved' : 'Rejected'}.`,
      });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to moderate review.');
    }
  };

  return (
    <div className="container-fluid py-4 px-lg-5">
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
        <div>
          <h3 className="fw-bolder mb-1 text-slate-900">Customer Feedback & Reviews</h3>
          <p className="text-muted small mb-0">
            Review customer service inquiries, respond to feedback, and moderate product ratings.
          </p>
        </div>
      </div>

      {alertMsg.text && (
        <div className={`alert alert-${alertMsg.type} alert-dismissible fade show rounded-3 small`} role="alert">
          {alertMsg.text}
          <button type="button" className="btn-close" onClick={() => setAlertMsg({ type: '', text: '' })}></button>
        </div>
      )}

      {/* Tabs */}
      <ul className="nav nav-pills mb-4 gap-2">
        <li className="nav-item">
          <button
            className={`btn btn-sm rounded-pill px-4 fw-bold ${
              activeTab === 'store' ? 'btn-primary' : 'btn-light border'
            }`}
            onClick={() => setActiveTab('store')}
          >
            <i className="bi bi-chat-left-dots me-1"></i> Store Inquiries & Feedback ({feedbackList.length})
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`btn btn-sm rounded-pill px-4 fw-bold ${
              activeTab === 'reviews' ? 'btn-primary' : 'btn-light border'
            }`}
            onClick={() => setActiveTab('reviews')}
          >
            <i className="bi bi-star-half me-1"></i> Product Reviews ({reviewsList.length})
          </button>
        </li>
      </ul>

      {/* TAB 1: STORE FEEDBACK */}
      {activeTab === 'store' && (
        <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
          <div className="p-3.5 border-bottom bg-slate-50 d-flex justify-content-between align-items-center">
            <span className="fw-bold text-slate-800 small">Customer Submissions</span>
            <button onClick={fetchData} className="btn btn-sm btn-light rounded-pill border">
              <i className="bi bi-arrow-clockwise"></i> Refresh
            </button>
          </div>

          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status"></div>
              <p className="text-muted small mt-2">Loading customer messages...</p>
            </div>
          ) : feedbackList.length === 0 ? (
            <div className="text-center py-5 text-muted small">
              No customer inquiries or feedback messages submitted yet.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0 text-sm">
                <thead className="table-light text-slate-600 text-xs">
                  <tr>
                    <th className="ps-4">Customer</th>
                    <th>Category</th>
                    <th>Subject & Message</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Staff Response</th>
                    <th className="text-end pe-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {feedbackList.map((fb) => (
                    <tr key={fb.id}>
                      <td className="ps-4">
                        <div className="fw-bold text-slate-900">{fb.customer_name || 'Anonymous Customer'}</div>
                        <small className="text-muted">{fb.customer_email}</small>
                      </td>
                      <td>
                        <span className="badge bg-slate-100 text-slate-700 rounded-pill px-2.5 py-1 text-xs">
                          {fb.category}
                        </span>
                      </td>
                      <td style={{ maxWidth: '300px' }}>
                        <div className="fw-semibold text-slate-900 text-truncate">{fb.subject}</div>
                        <div className="text-muted text-xs text-truncate">{fb.message}</div>
                      </td>
                      <td>
                        <small className="text-muted">{new Date(fb.created_at).toLocaleDateString()}</small>
                      </td>
                      <td>
                        <span
                          className={`badge rounded-pill px-2.5 py-1 text-xs ${
                            fb.status === 'RESOLVED'
                              ? 'bg-success'
                              : fb.status === 'IN_REVIEW'
                              ? 'bg-info text-dark'
                              : 'bg-warning text-dark'
                          }`}
                        >
                          {fb.status}
                        </span>
                      </td>
                      <td style={{ maxWidth: '200px' }}>
                        {fb.admin_response ? (
                          <div className="text-xs text-truncate text-success" title={fb.admin_response}>
                            <i className="bi bi-reply-fill me-1"></i>
                            {fb.admin_response}
                          </div>
                        ) : (
                          <span className="text-muted text-xs">Pending reply</span>
                        )}
                      </td>
                      <td className="text-end pe-4">
                        <button
                          onClick={() => handleOpenReplyModal(fb)}
                          className="btn btn-sm btn-outline-primary rounded-pill px-3 text-xs"
                        >
                          Reply
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

      {/* TAB 2: PRODUCT REVIEWS MODERATION */}
      {activeTab === 'reviews' && (
        <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
          <div className="p-3.5 border-bottom bg-slate-50 d-flex justify-content-between align-items-center">
            <span className="fw-bold text-slate-800 small">Product Ratings & Reviews</span>
            <button onClick={fetchData} className="btn btn-sm btn-light rounded-pill border">
              <i className="bi bi-arrow-clockwise"></i> Refresh
            </button>
          </div>

          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status"></div>
            </div>
          ) : reviewsList.length === 0 ? (
            <div className="text-center py-5 text-muted small">No product reviews yet.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0 text-sm">
                <thead className="table-light text-slate-600 text-xs">
                  <tr>
                    <th className="ps-4">Product</th>
                    <th>Customer</th>
                    <th>Rating</th>
                    <th>Review Content</th>
                    <th>Status</th>
                    <th className="text-end pe-4">Moderate</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewsList.map((rev) => (
                    <tr key={rev.id}>
                      <td className="ps-4">
                        <strong className="text-slate-900">{rev.productName}</strong>
                      </td>
                      <td>
                        <span className="text-slate-800">{rev.username}</span>
                      </td>
                      <td>
                        <span className="text-warning fw-bold">
                          {rev.rating} <i className="bi bi-star-fill"></i>
                        </span>
                      </td>
                      <td style={{ maxWidth: '300px' }}>
                        <div className="text-xs text-slate-700">{rev.comment || 'No written text'}</div>
                      </td>
                      <td>
                        <span
                          className={`badge rounded-pill px-2.5 py-1 text-xs ${
                            rev.is_approved !== false ? 'bg-success' : 'bg-danger'
                          }`}
                        >
                          {rev.is_approved !== false ? 'Approved' : 'Hidden'}
                        </span>
                      </td>
                      <td className="text-end pe-4">
                        <div className="d-flex justify-content-end gap-1">
                          {rev.is_approved === false ? (
                            <button
                              onClick={() => handleModerateReview(rev.id, true)}
                              className="btn btn-sm btn-success rounded-pill px-2.5 text-xs"
                            >
                              Approve
                            </button>
                          ) : (
                            <button
                              onClick={() => handleModerateReview(rev.id, false)}
                              className="btn btn-sm btn-outline-danger rounded-pill px-2.5 text-xs"
                            >
                              Hide
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Response Modal */}
      {selectedFeedback && (
        <div
          className="modal show d-block"
          style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(3px)' }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 border-0 shadow-lg">
              <div className="modal-header border-bottom px-4 py-3">
                <h5 className="modal-title fw-bold">Respond to Customer Inquiry</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setSelectedFeedback(null)}
                ></button>
              </div>
              <form onSubmit={handleSubmitReply}>
                <div className="modal-body p-4">
                  <div className="p-3 bg-light rounded-3 mb-3 text-xs">
                    <div><strong>Customer:</strong> {selectedFeedback.customer_name} ({selectedFeedback.customer_email})</div>
                    <div><strong>Subject:</strong> {selectedFeedback.subject}</div>
                    <div className="mt-2 text-slate-800">"{selectedFeedback.message}"</div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold">Status</label>
                    <select
                      className="form-select"
                      value={feedbackStatus}
                      onChange={(e) => setFeedbackStatus(e.target.value)}
                    >
                      <option value="NEW">New</option>
                      <option value="IN_REVIEW">In Review</option>
                      <option value="RESOLVED">Resolved</option>
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold">Staff Response to Customer *</label>
                    <textarea
                      className="form-control"
                      rows="4"
                      placeholder="Write a clear, helpful response..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      required
                    ></textarea>
                  </div>
                </div>
                <div className="modal-footer border-top px-4 py-3">
                  <button
                    type="button"
                    className="btn btn-light rounded-pill px-4"
                    onClick={() => setSelectedFeedback(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary rounded-pill px-4 fw-bold"
                    disabled={submittingReply}
                  >
                    {submittingReply ? 'Saving...' : 'Send Response'}
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

export default ManagerFeedbackPage;
