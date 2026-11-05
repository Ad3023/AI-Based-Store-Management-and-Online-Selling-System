import { useState } from 'react';
import api from '../../../api';
import { validateEmail, validatePhone } from '../../../utils/validation';

export const useSupplierActions = (fetchSuppliers, setFeedback) => {
  const [submitting, setSubmitting] = useState(false);
  const [accountSubmitting, setAccountSubmitting] = useState(false);
  const [selectedSupplierHistory, setSelectedSupplierHistory] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyTab, setHistoryTab] = useState('products');

  const saveSupplier = async (mode, supplierId, formData, onSuccess) => {
    if (!formData.name?.trim()) return alert('Supplier name is required.');
    const payload = { ...formData };
    if (formData.email?.trim()) {
      const emailRes = validateEmail(formData.email, false);
      if (!emailRes.isValid) return alert(emailRes.error);
      payload.email = emailRes.value;
    }
    if (formData.phone?.trim()) {
      const phoneRes = validatePhone(formData.phone, false);
      if (!phoneRes.isValid) return alert(phoneRes.error);
      payload.phone = phoneRes.formatted || phoneRes.value;
    }
    try {
      setSubmitting(true);
      if (mode === 'create') {
        const res = await api.post('products/suppliers/', payload);
        setFeedback({ type: 'success', text: `Supplier "${res.data.name}" registered successfully!` });
      } else {
        const res = await api.put(`products/suppliers/${supplierId}/`, payload);
        setFeedback({ type: 'success', text: `Supplier "${res.data.name}" updated successfully!` });
      }
      onSuccess();
      fetchSuppliers();
    } catch (err) {
      alert(err.response?.data?.name?.[0] || err.response?.data?.error || 'Failed to save supplier.');
    } finally {
      setSubmitting(false);
    }
  };

  const updateSupplierStatus = async (id, newStatus) => {
    try {
      await api.patch(`products/suppliers/${id}/`, {
        status: newStatus,
        is_active: newStatus === 'ACTIVE',
      });
      setFeedback({ type: 'success', text: `Supplier status changed to ${newStatus}.` });
      fetchSuppliers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update supplier status.');
    }
  };

  const deleteSupplier = async (id, name) => {
    if (!window.confirm(`Are you sure you want to remove supplier "${name}"?`)) return;
    try {
      await api.delete(`products/suppliers/${id}/`);
      setFeedback({ type: 'success', text: `Supplier "${name}" was removed successfully.` });
      fetchSuppliers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete supplier.');
    }
  };

  const loadSupplierHistory = async (supplierId) => {
    try {
      setLoadingHistory(true);
      setSelectedSupplierHistory(null);
      setHistoryTab('products');
      const res = await api.get(`products/suppliers/${supplierId}/history/`);
      setSelectedSupplierHistory(res.data);
    } catch (err) {
      alert('Could not retrieve supplier history details.');
    } finally {
      setLoadingHistory(false);
    }
  };

  const savePortalAccount = async (accountSupplier, accountFormData, onSuccess) => {
    if (!accountSupplier) return;
    const emailRes = validateEmail(accountFormData.email, true);
    if (!emailRes.isValid) return alert(emailRes.error || 'A valid @gmail.com email is required.');
    const phoneRes = validatePhone(accountFormData.phone, true);
    if (!phoneRes.isValid) return alert(phoneRes.error || 'A valid 10-digit phone number is required.');
    if (!accountFormData.password || accountFormData.password.length < 8) return alert('Password must be at least 8 characters long.');

    try {
      setAccountSubmitting(true);
      await api.post(`products/suppliers/${accountSupplier.id}/create-account/`, {
        email: emailRes.value, phone: phoneRes.formatted || phoneRes.value,
        password: accountFormData.password, full_name: accountFormData.full_name,
      });
      setFeedback({ type: 'success', text: `Portal credentials updated for ${accountSupplier.name}!` });
      onSuccess();
      fetchSuppliers();
    } catch (err) {
      alert(`Error: ${err.response?.data?.error || err.response?.data?.detail || 'Failed to provision portal account.'}`);
    } finally {
      setAccountSubmitting(false);
    }
  };

  return {
    submitting,
    accountSubmitting,
    selectedSupplierHistory,
    setSelectedSupplierHistory,
    loadingHistory,
    historyTab,
    setHistoryTab,
    saveSupplier,
    updateSupplierStatus,
    deleteSupplier,
    loadSupplierHistory,
    savePortalAccount,
  };
};

