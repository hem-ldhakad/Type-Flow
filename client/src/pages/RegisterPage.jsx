// src/pages/RegisterPage.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/axios';
import styles from './AuthPage.module.css';

const validate = ({ username, email, password, confirm }) => {
    if (!username.trim()) return 'Username is required.';
    if (username.length < 3) return 'Username must be at least 3 characters.';
    if (!/^[a-zA-Z0-9_]+$/.test(username))
        return 'Username can only contain letters, numbers, and underscores.';
    if (!email.trim()) return 'Email is required.';
    if (!/\S+@\S+\.\S+/.test(email)) return 'Enter a valid email address.';
    if (!password) return 'Password is required.';
    if (password.length < 8) return 'Password must be at least 8 characters.';
    if (password !== confirm) return 'Passwords do not match.';
    return null;
};

export default function RegisterPage() {
    const { login } = useAuth();
    const navigate = useNavigate();

    const [form, setForm] = useState({
        username: '',
        email: '',
        password: '',
        confirm: '',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const strength = (() => {
        const p = form.password;
        if (!p) return { label: '', level: 0 };
        if (p.length < 6) return { label: 'Weak', level: 1, color: 'var(--danger)' };
        if (p.length < 10) return { label: 'Fair', level: 2, color: 'var(--warning)' };
        return { label: 'Strong', level: 3, color: 'var(--accent)' };
    })();

    const handleChange = (e) =>
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const validationError = validate(form);
        if (validationError) { setError(validationError); return; }

        setLoading(true);
        try {
            const res = await api.post('/auth/register', {
                username: form.username,
                email: form.email,
                password: form.password,
            });

            if (res.data?.success && res.data?.data) {
                const { user, token } = res.data.data;
                login(user, token);
                navigate('/dashboard', { replace: true });
            } else {
                throw new Error('Registration response did not contain user data.');
            }
        } catch (err) {
            const serverMsg = err.response?.data?.message || err.message;
            setError(serverMsg || 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.pageWrapper}>
            <div className={`card ${styles.authCard}`}>
                <div className={styles.cardTop}>
                    <span className={styles.pandaEmoji}>🎋</span>
                    <h1 className={styles.title}>Join TypeFLOW</h1>
                    <p className={styles.sub}>Create your free account and start racing</p>
                </div>

                {error && (
                    <div role="alert" className={styles.errorBanner}>
                        ⚠ {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className={styles.form} noValidate>
                    <label className={styles.label}>
                        Username
                        <input
                            id="reg-username"
                            name="username"
                            type="text"
                            required
                            autoComplete="username"
                            className="input-field"
                            placeholder="speedy_panda"
                            value={form.username}
                            onChange={handleChange}
                            disabled={loading}
                        />
                    </label>

                    <label className={styles.label}>
                        Email
                        <input
                            id="reg-email"
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
                            id="reg-password"
                            name="password"
                            type="password"
                            required
                            autoComplete="new-password"
                            className="input-field"
                            placeholder="8+ characters"
                            value={form.password}
                            onChange={handleChange}
                            disabled={loading}
                        />
                        <span className={styles.passwordUniqueWarning}>
                            ⚠️ For security, your password must be unique and cannot match other users&apos; passwords.
                        </span>
                        {form.password && (
                            <div className={styles.strengthWrap} aria-label={`Password strength: ${strength.label}`}>
                                {[1, 2, 3].map((n) => (
                                    <div
                                        key={n}
                                        className={styles.strengthBar}
                                        style={{
                                            background: n <= strength.level ? strength.color : 'var(--border)',
                                        }}
                                    />
                                ))}
                                <span className={styles.strengthLabel} style={{ color: strength.color }}>
                                    {strength.label}
                                </span>
                            </div>
                        )}
                    </label>

                    <label className={styles.label}>
                        Confirm password
                        <input
                            id="reg-confirm"
                            name="confirm"
                            type="password"
                            required
                            autoComplete="new-password"
                            className={`input-field ${form.confirm && form.confirm !== form.password ? styles.inputError : ''
                                }`}
                            placeholder="Repeat password"
                            value={form.confirm}
                            onChange={handleChange}
                            disabled={loading}
                        />
                        {form.confirm && form.confirm !== form.password && (
                            <span className={styles.fieldError}>Passwords don&apos;t match yet</span>
                        )}
                    </label>

                    <button
                        id="reg-submit"
                        type="submit"
                        className={`btn btn-primary ${styles.submitBtn}`}
                        disabled={loading}
                    >
                        {loading ? (
                            <span className={styles.spinner} aria-label="Creating account…">⏳ Creating account…</span>
                        ) : (
                            'Create account 🐼'
                        )}
                    </button>
                </form>

                <p className={styles.switch}>
                    Already have an account?{' '}
                    <Link to="/login" className={styles.switchLink}>Sign in</Link>
                </p>
            </div>
        </div>
    );
}
