// src/pages/ProfilePage.jsx
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/axios';
import styles from './ProfilePage.module.css';

const positionLabel = (pos) => {
    if (pos === 1) return '🥇';
    if (pos === 2) return '🥈';
    if (pos === 3) return '🥉';
    return `#${pos}`;
};

const formatDate = (iso) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const PAGE_SIZE = 10;

export default function ProfilePage() {
    const { userId } = useParams();
    const { user: me } = useAuth();
    const isOwnProfile = me?.id === userId;

    const [profile, setProfile] = useState(null);
    const [stats, setStats] = useState(null);
    const [matches, setMatches] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [loadingMatches, setLoadingMatches] = useState(false);
    const [error, setError] = useState('');

    // Fetch profile stats from the backend
    useEffect(() => {
        let active = true;
        setLoadingProfile(true);
        setError('');

        api.get(`/users/${userId}/stats`)
            .then((res) => {
                if (active && res.data?.success) {
                    const d = res.data.data;
                    setProfile({ username: d.username, level: d.level, xp: d.xp, joinedAt: d.joinedAt });
                    setStats(d.statistics);
                }
            })
            .catch((err) => {
                if (active) setError(err.response?.data?.message || 'Failed to load profile.');
            })
            .finally(() => { if (active) setLoadingProfile(false); });

        return () => { active = false; };
    }, [userId]);

    // Fetch match history (only for own profile; others cannot see history)
    const fetchMatches = (page = 1) => {
        if (!isOwnProfile) return;
        setLoadingMatches(true);

        api.get(`/matches?page=${page}&limit=${PAGE_SIZE}`)
            .then((res) => {
                if (res.data?.success) {
                    const d = res.data.data;
                    setMatches((prev) => page === 1 ? d.matches : [...prev, ...d.matches]);
                    setPagination(d.pagination);
                }
            })
            .catch(() => { })
            .finally(() => setLoadingMatches(false));
    };

    // Load initial match history when profile resolves
    useEffect(() => {
        if (!loadingProfile && !error && isOwnProfile) {
            fetchMatches(1);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadingProfile, error, isOwnProfile]);

    if (loadingProfile) {
        return (
            <div className={styles.loadingPage}>
                <span className={styles.loadingIcon}>🎋</span>
                <p>Loading profile...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className={styles.errorPage}>
                <div className={`card ${styles.errorCard}`}>
                    <h2>Profile not found</h2>
                    <p>{error}</p>
                    <Link to="/dashboard" className="btn btn-primary">Back to Dashboard</Link>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <div className="container">
                {/* Profile header */}
                <div className={`card ${styles.profileCard}`}>
                    <div className={styles.avatarWrap}>
                        <div className={styles.avatarBig}>🐼</div>
                        <div className={styles.profileInfo}>
                            <h1 className={styles.name}>{profile?.username}</h1>
                            <div className={styles.badges}>
                                <span className="badge badge-green">Level {profile?.level}</span>
                                <span className="badge badge-muted">🎋 {profile?.xp} XP</span>
                                {isOwnProfile && <span className="badge badge-pink">You</span>}
                            </div>
                            <p className={styles.joined}>
                                Member since {profile?.joinedAt
                                    ? new Date(profile.joinedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                                    : '—'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Personal statistics grid */}
                {stats && (
                    <>
                        <h2 className={styles.sectionTitle}>Personal Statistics</h2>
                        <div className={styles.statsGrid}>
                            {[
                                { label: 'Total Races', value: stats.totalRaces, icon: '🏁' },
                                { label: 'Wins', value: stats.wins, icon: '🥇' },
                                { label: 'Win Rate', value: `${stats.winRatio}%`, icon: '📈' },
                                { label: 'Avg WPM', value: stats.averageWpm > 0 ? stats.averageWpm : '—', icon: '⚡' },
                                { label: 'Peak WPM', value: stats.peakWpm > 0 ? stats.peakWpm : '—', icon: '🔥' },
                                { label: 'Avg Accuracy', value: stats.averageAccuracy > 0 ? `${stats.averageAccuracy}%` : '—', icon: '🎯' },
                            ].map((s) => (
                                <div key={s.label} className={`card ${styles.statCard}`}>
                                    <span className={styles.statIcon}>{s.icon}</span>
                                    <span className={styles.statVal}>{s.value}</span>
                                    <span className={styles.statLabel}>{s.label}</span>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* Match history — only visible on own profile */}
                {isOwnProfile && (
                    <>
                        <h2 className={styles.sectionTitle}>Match History</h2>
                        {matches.length === 0 && !loadingMatches && (
                            <div className={`card ${styles.emptyHistory}`}>
                                <span>🐼</span>
                                <p>No matches recorded yet. Join a room and race!</p>
                            </div>
                        )}

                        <div className={styles.historyList}>
                            {matches.map((m) => (
                                <div key={m.resultId} className={`card ${styles.historyRow}`}>
                                    <span className={styles.position}>{positionLabel(m.position)}</span>
                                    <div className={styles.historyStats}>
                                        <span className={styles.wpm}>{m.wpm} <small>WPM</small></span>
                                        <span className={styles.acc}>{m.accuracy}% <small>ACC</small></span>
                                    </div>
                                    <div className={styles.historyMeta}>
                                        {m.paragraph?.wordCount && (
                                            <span className={styles.wordCount}>{m.paragraph.wordCount} words</span>
                                        )}
                                        <span className={styles.date}>{formatDate(m.startedAt)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {pagination.page < pagination.totalPages && (
                            <div className={styles.loadMoreWrap}>
                                <button
                                    onClick={() => fetchMatches(pagination.page + 1)}
                                    className="btn btn-ghost"
                                    disabled={loadingMatches}
                                >
                                    {loadingMatches ? 'Loading…' : 'Load More Matches'}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
