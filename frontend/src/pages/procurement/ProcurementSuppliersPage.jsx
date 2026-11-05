import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import SupplierHeader from './components/SupplierHeader';
import SupplierFilterBar from './components/SupplierFilterBar';
import SupplierTable from './components/SupplierTable';
import SupplierPortalAccountsTable from './components/SupplierPortalAccountsTable';
import SupplierActivityHistoryTable from './components/SupplierActivityHistoryTable';
import SupplierFormModal from './components/SupplierFormModal';
import SupplierPortalModal from './components/SupplierPortalModal';
import SupplierHistoryModal from './components/SupplierHistoryModal';
import { useSupplierActions } from './components/useSupplierActions';

const ProcurementSuppliersPage = () => {
  const { isAdmin, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentTab = searchParams.get('tab') || 'directory';
  const actionParam = searchParams.get('action');

  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [currentSupplierId, setCurrentSupplierId] = useState(null);
  const [formData, setFormData] = useState({
    name: '', contact_person: '', email: '', phone: '', address: '', notes: '',
    supplied_categories: 'Laptops, Smartphones, Accessories', status: 'ACTIVE', is_active: true,
  });

  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountSupplier, setAccountSupplier] = useState(null);
  const [accountFormData, setAccountFormData] = useState({ email: '', phone: '', password: '', full_name: '' });

  const fetchSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('products/suppliers/');
      setSuppliers(res.data.results || res.data || []);
    } catch (err) {
      console.error('Failed to load suppliers:', err);
      setFeedback({ type: 'danger', text: 'Failed to load suppliers from database.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const {
    submitting, accountSubmitting, selectedSupplierHistory, setSelectedSupplierHistory,
    loadingHistory, historyTab, setHistoryTab, saveSupplier, updateSupplierStatus,
    deleteSupplier, loadSupplierHistory, savePortalAccount
  } = useSupplierActions(fetchSuppliers, setFeedback);

  const handleOpenCreate = useCallback(() => {
    setModalMode('create');
    setCurrentSupplierId(null);
    setFormData({
      name: '', contact_person: '', email: '', phone: '', address: '', notes: '',
      supplied_categories: 'Laptops, Smartphones, Accessories', status: 'ACTIVE', is_active: true,
    });
    setShowModal(true);
  }, []);

  useEffect(() => {
    if (actionParam === 'add') handleOpenCreate();
  }, [actionParam, handleOpenCreate]);

  const handleTabChange = (newTab) => {
    const params = new URLSearchParams(searchParams);
    if (newTab === 'directory') params.delete('tab');
    else params.set('tab', newTab);
    params.delete('action');
    setSearchParams(params);
  };

  const handleOpenEdit = (sup) => {
    setModalMode('edit');
    setCurrentSupplierId(sup.id);
    setFormData({
      name: sup.name || '', contact_person: sup.contact_person || '', email: sup.email || '',
      phone: sup.phone || '', address: sup.address || '', notes: sup.notes || '',
      supplied_categories: sup.supplied_categories || '',
      status: sup.status || (sup.is_active ? 'ACTIVE' : 'SUSPENDED'),
      is_active: Boolean(sup.is_active),
    });
    setShowModal(true);
  };

  const handleOpenCreatePortalAccount = (sup) => {
    setAccountSupplier(sup);
    setAccountFormData({
      email: sup.email && sup.email.endsWith('@gmail.com') ? sup.email : '',
      phone: sup.phone || '', password: '', full_name: sup.contact_person || sup.name || '',
    });
    setShowAccountModal(true);
  };

  const filteredSuppliers = suppliers.filter((s) => {
    const matchesSearch = !search.trim() ||
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.contact_person?.toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase()) ||
      s.phone?.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (statusFilter === 'ALL' || s.status === statusFilter);
  });

  return (
    <div className="pb-5">
      <SupplierHeader activeTab={currentTab} onTabChange={handleTabChange} isAdmin={isAdmin} onOpenCreate={handleOpenCreate} />
      {feedback.text && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show rounded-3 text-xs mb-4 shadow-sm`} role="alert">
          {feedback.text}
          <button type="button" className="btn-close" onClick={() => setFeedback({ type: '', text: '' })}></button>
        </div>
      )}

      {currentTab === 'directory' && (
        <>
          <SupplierFilterBar search={search} setSearch={setSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter} totalCount={filteredSuppliers.length} />
          <SupplierTable loading={loading} suppliers={filteredSuppliers} search={search} statusFilter={statusFilter} onOpenCreate={handleOpenCreate} onOpenEdit={handleOpenEdit} onOpenHistory={loadSupplierHistory} onOpenPortalAccount={handleOpenCreatePortalAccount} onUpdateStatus={updateSupplierStatus} onDeleteSupplier={deleteSupplier} isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} />
        </>
      )}

      {currentTab === 'accounts' && (
        <SupplierPortalAccountsTable suppliers={suppliers} loading={loading} onOpenPortalAccount={handleOpenCreatePortalAccount} onToggleStatus={updateSupplierStatus} isAdmin={isAdmin} />
      )}

      {currentTab === 'history' && (
        <SupplierActivityHistoryTable suppliers={suppliers} onOpenHistory={loadSupplierHistory} />
      )}

      <SupplierFormModal show={showModal} mode={modalMode} formData={formData} setFormData={setFormData} onSubmit={(e) => { e.preventDefault(); saveSupplier(modalMode, currentSupplierId, formData, () => setShowModal(false)); }} onClose={() => { setShowModal(false); if (actionParam === 'add') { const p = new URLSearchParams(searchParams); p.delete('action'); setSearchParams(p); } }} submitting={submitting} />
      <SupplierPortalModal show={showAccountModal} supplier={accountSupplier} formData={accountFormData} setFormData={setAccountFormData} onSubmit={(e) => { e.preventDefault(); savePortalAccount(accountSupplier, accountFormData, () => setShowAccountModal(false)); }} onClose={() => setShowAccountModal(false)} submitting={accountSubmitting} />
      <SupplierHistoryModal data={selectedSupplierHistory} loading={loadingHistory} activeTab={historyTab} setActiveTab={setHistoryTab} onClose={() => setSelectedSupplierHistory(null)} isAdmin={isAdmin} onCreatePO={() => { const sid = selectedSupplierHistory?.supplier?.id; setSelectedSupplierHistory(null); navigate(`/manager/procurement/purchase-orders/create?supplier=${sid}`); }} />
    </div>
  );
};

export default ProcurementSuppliersPage;
