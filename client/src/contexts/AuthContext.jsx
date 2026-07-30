// src/contexts/AuthContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [statsVersion, setStatsVersion] = useState(0);

    // Verifies the stored JWT token with the backend on initial boot
    const checkAuth = useCallback(async () => {
        const token = localStorage.getItem('tf_token');
        if (!token) {
            setLoading(false);
            return;
        }

        try {
            // Axios interceptor will inject the Bearer token automatically
            const res = await api.get('/auth/me');
            if (res.data?.success && res.data?.data?.user) {
                setUser(res.data.data.user);
                setStatsVersion((prev) => prev + 1);
            } else {
                // Safe fallback if response schema is unexpected
                localStorage.removeItem('tf_token');
                localStorage.removeItem('tf_user');
            }
        } catch {
            // Clear stale/expired token on any fetch fail (e.g. 401 Unauthorized)
            localStorage.removeItem('tf_token');
            localStorage.removeItem('tf_user');
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    const login = useCallback((userData, token) => {
        localStorage.setItem('tf_token', token);
        localStorage.setItem('tf_user', JSON.stringify(userData));
        setUser(userData);
        setStatsVersion((prev) => prev + 1);
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('tf_token');
        localStorage.removeItem('tf_user');
        setUser(null);
        setStatsVersion((prev) => prev + 1);
    }, []);

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                login,
                logout,
                isAuthenticated: !!user,
                refetchUser: checkAuth,
                statsVersion,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
