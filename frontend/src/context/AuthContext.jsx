import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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

  // Derive roles directly from actual backend user object
  const isCustomer = user?.role === 'customer';
  const isStoreManager = user?.role === 'store_manager' || Boolean(user?.is_superuser);
  const isAdmin = user?.role === 'admin' || Boolean(user?.is_superuser);
  const isManagerOrAdmin = isStoreManager || isAdmin;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        updateProfile,
        uploadAvatar,
        removeAvatar,
        isCustomer,
        isStoreManager,
        isAdmin,
        isManagerOrAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
