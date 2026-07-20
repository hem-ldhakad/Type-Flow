// src/components/GuestRoute.jsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function GuestRoute({ children }) {
    const { isAuthenticated, loading } = useAuth();
    const location = useLocation();

    // If initial auth token lookup is still running, bypass decides (GlobalLayout shows spinner)
    if (loading) {
        return null;
    }

    const destination = location.state?.from || '/dashboard';

    if (isAuthenticated) {
        return <Navigate to={destination} replace />;
    }

    return children;
}
