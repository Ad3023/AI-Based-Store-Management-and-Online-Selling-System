import React, { useState, useEffect, useCallback } from 'react';
import api from '../../../api';

const SupplierActivityHistoryTable = ({ suppliers, onOpenHistory }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('auth/audit-logs/');
      const allLogs = res.data.results || res.data || [];
      // Filter logs related to suppliers or procurement
      const supplierLogs = allLogs.filter((log) => {
        const act = (log.action || '').toUpperCase();
        const det = (log.details || '').toLowerCase();
        return (
          act.includes('SUPPLIER') ||
          act.includes('PO_') ||
          act.includes('DELIVERY') ||
          det.includes('supplier') ||
          det.includes('purchase order') ||
          det.includes('po ')
        );
      });
      setLogs(supplierLogs.length > 0 ? supplierLogs : allLogs.slice(0, 30));
    } catch (err) {
      console.warn('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filtered = logs.filter((log) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      log.action?.toLowerCase().includes(q) ||
      log.details?.toLowerCase().includes(q) ||
      log.user_username?.toLowerCase().includes(q);
    return matchesSearch;
  });

  return (
    <div className="card ethio-card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
      {/* Sub-header Filter Bar */}
      <div className="p-3 border-bottom bg-slate-50 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2">
        <div className="d-flex align-items-center gap-2 flex-grow-1" style={{ maxWidth: '400px' }}>
          <input
            type="text"
            className="form-control text-xs"
            placeholder="Search activity by action, details, user..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="d-flex align-items-center gap-2">
          <select
            className="form-select text-xs"
            value={selectedSupplierId}
            onChange={(e) => {
              setSelectedSupplierId(e.target.value);
              if (e.target.value) onOpenHistory(e.target.value);
            }}
          >
            <option value="">-- Inspect Specific Supplier Ledger --</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="btn btn-outline-secondary btn-xs rounded-pill px-2.5 py-1 text-nowrap"
            onClick={fetchLogs}
            title="Refresh database activity log"
          >
            <i className="bi bi-arrow-clockwise me-1"></i> Refresh
          </button>
        </div>
      </div>

      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0 text-xs">
          <thead className="table-light text-slate-500 uppercase font-semibold text-[11px] border-bottom">
            <tr>
              <th className="ps-4">Timestamp</th>
              <th>Action / Event</th>
              <th>Details &amp; Audit Summary</th>
              <th>Initiated By</th>
              <th className="text-end pe-4">IP Address</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" className="text-center py-5 text-muted">
                  <div className="spinner-border spinner-border-sm text-primary me-2"></div>
                  Loading supplier activity records...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center py-5 text-muted">
                  <i className="bi bi-clock-history fs-2 d-block text-slate-300 mb-2"></i>
                  No supplier activity records found in the database.
                </td>
              </tr>
            ) : (
              filtered.map((log) => (
                <tr key={log.id}>
                  <td className="ps-4 text-slate-500 text-[11px] text-nowrap">
                    {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                  </td>
                  <td>
                    <span className={`badge rounded-pill text-[10px] ${
                      log.action?.includes('CREATED') || log.action?.includes('ACCEPTED')
                        ? 'bg-success bg-opacity-10 text-success border border-success border-opacity-25'
                        : log.action?.includes('REJECTED') || log.action?.includes('SUSPENDED')
                        ? 'bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25'
                        : 'bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25'
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="text-slate-800 fw-medium">
                    <div className="text-truncate" style={{ maxWidth: '420px' }} title={log.details}>
                      {log.details || '—'}
                    </div>
                  </td>
                  <td>
                    <div className="fw-semibold text-slate-700">
                      {log.user_username || log.user?.username || 'System'}
                    </div>
                  </td>
                  <td className="text-end pe-4 text-slate-400 font-monospace text-[11px]">
                    {log.ip_address || '127.0.0.1'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SupplierActivityHistoryTable;

