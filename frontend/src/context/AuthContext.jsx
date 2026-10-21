import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      api.get('auth/profile/')
        .then((res) => {
          setUser(res.data);
          localStorage.setItem('user', JSON.stringify(res.data));
        })
        .catch(() => {
          logout();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (username, password) => {
    const res = await api.post('auth/login/', { username, password });
    const { token: authToken, user: userData } = res.data;
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(userData));
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

  const logout = () => {
    if (token) {
      api.post('auth/logout/').catch(() => {});
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const updateProfile = async (data) => {
    const res = await api.put('auth/profile/', data);
    setUser(res.data);
    localStorage.setItem('user', JSON.stringify(res.data));
    return res.data;
  };

  const isCustomer = user?.role === 'customer';
  const isStoreManager = user?.role === 'store_manager' || user?.is_superuser;
  const isAdmin = user?.role === 'admin' || user?.is_superuser;
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
