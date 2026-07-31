// src/api/axios.js
// Central Axios instance. All requests will include this base URL.
// When backend is connected, set VITE_API_URL in .env
import axios from 'axios';

const getApiBaseUrl = () => {
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        return 'http://localhost:5001/api';
    }
    return 'https://type-flow-production.up.railway.app/api';
};

const api = axios.create({
    baseURL: getApiBaseUrl(),
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Attach JWT token from localStorage on every request
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('tf_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Global 401 handler – clear stale token
api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401) {
            localStorage.removeItem('tf_token');
            localStorage.removeItem('tf_user');
        }
        return Promise.reject(err);
    }
);

export default api;
