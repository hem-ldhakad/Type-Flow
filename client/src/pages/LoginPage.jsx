// src/pages/LoginPage.jsx
import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/axios';
import styles from './AuthPage.module.css';

const validate = ({ email, password }) => {
    if (!email.trim()) return 'Email is required.';
    if (!/\S+@\S+\.\S+/.test(email)) return 'Enter a valid email address.';
    if (!password) return 'Password is required.';
    if (password.length < 6) return 'Password must be at least 6 characters.';
    return null;
};

export default function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const from = location.state?.from || '/dashboard';

    const [form, setForm] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e) =>
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const validationError = validate(form);
        if (validationError) { setError(validationError); return; }

        setLoading(true);
        try {
            const res = await api.post('/auth/login', {
                email: form.email,
                password: form.password,
            });

            if (res.data?.success && res.data?.data) {
                const { user, token } = res.data.data;
                login(user, token);
                navigate(from, { replace: true });
            } else {
                throw new Error('Authentication response did not contain user data.');
            }
        } catch (err) {
            // Pull specific server error messages returned by registration middleware
            const serverMsg = err.response?.data?.message || err.message;
            setError(serverMsg || 'Sign in failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.pageWrapper}>
            <div className={`card ${styles.authCard}`}>
                <div className={styles.cardTop}>
                    <span className={styles.pandaEmoji}>🐼</span>
                    <h1 className={styles.title}>Welcome back</h1>
                    <p className={styles.sub}>Sign in to your TypeFLOW account</p>
                </div>

                {error && (
                    <div role="alert" className={styles.errorBanner}>
                        ⚠ {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className={styles.form} noValidate>
                    <label className={styles.label}>
                        Email
                        <input
                            id="login-email"
                            name="email"
                            type="email"
                            required
                            autoComplete="email"
                            className="input-field"
                            placeholder="panda@typeflow.gg"
                            value={form.email}
                            onChange={handleChange}
                            disabled={loading}
                        />
                    </label>

                    <label className={styles.label}>
                        Password
                        <input
                            id="login-password"
                            name="password"
                            type="password"
                            required
                            autoComplete="current-password"
                            className="input-field"
                            placeholder="••••••••"
                            value={form.password}
                            onChange={handleChange}
                            disabled={loading}
                        />
                    </label>

                    <button
                        id="login-submit"
                        type="submit"
                        className={`btn btn-primary ${styles.submitBtn}`}
                        disabled={loading}
                    >
                        {loading ? (
                            <span className={styles.spinner} aria-label="Signing in…">⏳ Signing in…</span>
                        ) : (
                            'Sign in 🎋'
                        )}
                    </button>
                </form>

                <p className={styles.switch}>
                    Don&apos;t have an account?{' '}
                    <Link to="/register" className={styles.switchLink}>Create one</Link>
                </p>
            </div>
        </div>
    );
}
