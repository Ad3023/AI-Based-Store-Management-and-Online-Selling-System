import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import api from '../api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user') || sessionStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('token') || sessionStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    if (token) {
      api.post('auth/logout/').catch(() => {});
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    setToken(null);
    setUser(null);
  }, [token]);

  useEffect(() => {
    if (token) {
      api.get('auth/profile/')
        .then((res) => {
          setUser(res.data);
          const storage = localStorage.getItem('token') ? localStorage : sessionStorage;
          storage.setItem('user', JSON.stringify(res.data));
        })
        .catch(() => {
          logout();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token, logout]);

  const login = async (username, password, rememberMe = true) => {
    const res = await api.post('auth/login/', { username, password });
    const { token: authToken, user: userData } = res.data;
    const storage = rememberMe ? localStorage : sessionStorage;
    
    // Clear the opposite storage to prevent desync
    if (rememberMe) {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }

    storage.setItem('token', authToken);
    storage.setItem('user', JSON.stringify(userData));
    setToken(authToken);
    setUser(userData);
    return userData;
  };

  const register = async (userData) => {
    const res = await api.post('auth/register/', userData);
    const { token: authToken, user: newUser } = res.data;
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(authToken);
    setUser(newUser);
    return newUser;
  };

  const loginWithGoogle = async (credentialOrIdToken) => {
    const res = await api.post('auth/google/', {
      credential: credentialOrIdToken,
      id_token: credentialOrIdToken,
    });
    const { token: authToken, user: userData } = res.data;
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(userData));
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    setToken(authToken);
    setUser(userData);
    return userData;
  };

  const updateProfile = async (data) => {
    const res = await api.put('auth/profile/', data);
    setUser(res.data);
    const storage = localStorage.getItem('token') ? localStorage : sessionStorage;
    storage.setItem('user', JSON.stringify(res.data));
    return res.data;
  };

  const uploadAvatar = async (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    const res = await api.post('auth/profile/avatar/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const updatedUser = res.data.user;
    setUser(updatedUser);
    const storage = localStorage.getItem('token') ? localStorage : sessionStorage;
    storage.setItem('user', JSON.stringify(updatedUser));
    return updatedUser;
  };

  const removeAvatar = async () => {
    const res = await api.delete('auth/profile/avatar/');
    const updatedUser = res.data.user;
    setUser(updatedUser);
    const storage = localStorage.getItem('token') ? localStorage : sessionStorage;
    storage.setItem('user', JSON.stringify(updatedUser));
    return updatedUser;
  };

  // Authoritative application roles (super_admin, admin, sub_admin, store_manager, order_manager, customer)
  const isSuperAdmin = Boolean(
    user?.role === 'super_admin' ||
    user?.is_super_admin ||
    user?.is_superuser ||
    user?.username === 'addisuguche_admin'
  );
  const isAdmin = Boolean(
    isSuperAdmin ||
    user?.role === 'admin' ||
    user?.username === 'admin'
  );
  const isSubAdmin = Boolean(
    user?.role === 'sub_admin' ||
    user?.is_sub_admin
  );
  const isOrderManager = Boolean(user?.role === 'order_manager');
  // Store Manager has operational access; Admin has complete supervisory access
  const isStoreManager = Boolean(
    isAdmin ||
    user?.role === 'store_manager' ||
    (user?.is_staff && user?.role !== 'customer' && user?.role !== 'order_manager' && user?.role !== 'sub_admin')
  );
  const isCustomer = user?.role === 'customer' || (!isAdmin && !isSubAdmin && !isStoreManager && !isOrderManager);
  const isManagerOrAdmin = isAdmin || isSubAdmin || isStoreManager || isOrderManager;

  const userPermissions = useMemo(() => {
    return Array.isArray(user?.permissions) ? user.permissions : [];
  }, [user?.permissions]);

  const hasPermission = useCallback((permissionCode) => {
    if (!user) return false;
    if (isAdmin) return true;
    return userPermissions.includes(permissionCode);
  }, [user, isAdmin, userPermissions]);

  const hasAnyPermission = useCallback((permissionCodes) => {
    if (!user) return false;
    if (isAdmin) return true;
    if (!Array.isArray(permissionCodes)) return false;
    return permissionCodes.some((code) => userPermissions.includes(code));
  }, [user, isAdmin, userPermissions]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        loginWithGoogle,
        register,
        logout,
        updateProfile,
        uploadAvatar,
        removeAvatar,
        isSuperAdmin,
        isAdmin,
        isSubAdmin,
        isCustomer,
        isStoreManager,
        isOrderManager,
        isManagerOrAdmin,
        userPermissions,
        hasPermission,
        hasAnyPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
