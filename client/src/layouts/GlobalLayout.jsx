// src/layouts/GlobalLayout.jsx
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import styles from './GlobalLayout.module.css';

const PandaLogo = () => (
    <svg width="36" height="36" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Body */}
        <ellipse cx="40" cy="48" rx="26" ry="22" fill="currentColor" />
        {/* Head */}
        <circle cx="40" cy="28" r="20" fill="currentColor" />
        {/* Ears */}
        <circle cx="22" cy="12" r="9" fill="#2d2d2d" />
        <circle cx="58" cy="12" r="9" fill="#2d2d2d" />
        {/* Eye patches */}
        <ellipse cx="31" cy="27" rx="7" ry="8" fill="#1a1a1a" />
        <ellipse cx="49" cy="27" rx="7" ry="8" fill="#1a1a1a" />
        {/* Eyes */}
        <circle cx="31" cy="27" r="3.5" fill="white" />
        <circle cx="49" cy="27" r="3.5" fill="white" />
        <circle cx="32" cy="26" r="1.5" fill="#0f0f11" />
        <circle cx="50" cy="26" r="1.5" fill="#0f0f11" />
        {/* Nose */}
        <ellipse cx="40" cy="34" rx="3" ry="2" fill="#444" />
        {/* Mouth */}
        <path d="M36 38 Q40 42 44 38" stroke="#444" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        {/* Blush marks */}
        <ellipse cx="24" cy="35" rx="4" ry="2.5" fill="#f2a8b8" opacity="0.6" />
        <ellipse cx="56" cy="35" rx="4" ry="2.5" fill="#f2a8b8" opacity="0.6" />
        {/* Bamboo accent */}
        <rect x="54" y="50" width="4" height="18" rx="2" fill="#7cb87c" />
        <rect x="52" y="55" width="8" height="3" rx="1.5" fill="#5a9f5a" />
        <rect x="52" y="62" width="8" height="3" rx="1.5" fill="#5a9f5a" />
    </svg>
);

export default function GlobalLayout() {
    const { user, logout, isAuthenticated, loading } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <div className={styles.layout}>
            {/* ── Navbar ── */}
            <header className={styles.navbar}>
                <div className={`container ${styles.navInner}`}>
                    {/* Brand */}
                    <NavLink to="/" className={styles.brand}>
                        <span className={styles.logoIcon}><PandaLogo /></span>
                        <span className={styles.logoText}>
                            Type<span className={styles.logoAccent}>FLOW</span>
                        </span>
                    </NavLink>

                    {/* Nav links */}
                    <nav className={styles.navLinks}>
                        <NavLink
                            to="/"
                            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
                            end
                        >
                            Home
                        </NavLink>
                        <NavLink
                            to="/leaderboard"
                            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
                        >
                            🏆 Leaderboard
                        </NavLink>
                        {isAuthenticated && (
                            <>
                                <NavLink
                                    to="/dashboard"
                                    className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
                                >
                                    Dashboard
                                </NavLink>
                                <NavLink
                                    to={`/profile/${user?.id}`}
                                    className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
                                >
                                    Profile
                                </NavLink>
                            </>
                        )}
                    </nav>

                    {/* Right controls */}
                    <div className={styles.navRight}>
                        <ThemeToggle />
                        {loading ? (
                            <span className={styles.loadingNavChip}>🎋</span>
                        ) : isAuthenticated ? (
                            <div className={styles.userChip}>
                                <span className={styles.avatar}>
                                    {user?.username?.[0]?.toUpperCase() || '🐼'}
                                </span>
                                <span className={`${styles.userName} hide-mobile`}>{user?.username}</span>
                                <button className={`btn btn-ghost ${styles.logoutBtn}`} onClick={handleLogout}>
                                    Sign out
                                </button>
                            </div>
                        ) : (
                            <div className={styles.authBtns}>
                                <NavLink to="/login" className="btn btn-ghost">Sign in</NavLink>
                                <NavLink to="/register" className="btn btn-primary">Get started</NavLink>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* ── Content ── */}
            <main className={styles.main}>
                {loading ? (
                    <div className={styles.globalLoader}>
                        <div className={styles.loaderContent}>
                            <span className={styles.loaderPanda}>🐼</span>
                            <div className={styles.bambooTrack}>
                                <div className={styles.bambooFill} />
                            </div>
                            <p className={styles.loaderText}>Checking panda credentials…</p>
                        </div>
                    </div>
                ) : (
                    <Outlet />
                )}
            </main>

            {/* ── Footer ── */}
            <footer className={styles.footer}>
                <div className={`container ${styles.footerInner}`}>
                    <span className={styles.footerBrand}>
                        <span className={styles.footerPanda}>🐼</span> TypeFLOW
                    </span>
                    <span className={styles.footerMeta}>
                        Built with 🎋 and caffeine
                    </span>
                </div>
            </footer>
        </div>
    );
}
