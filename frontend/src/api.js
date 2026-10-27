import axios from 'axios';

let rawBase = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/';
if (!rawBase.endsWith('/')) {
  rawBase += '/';
}
const API_BASE_URL = rawBase;

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Token ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Avoid infinite redirect loop if already on login
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
export { API_BASE_URL };
