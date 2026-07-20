// src/pages/DashboardPage.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/axios';
import styles from './DashboardPage.module.css';

export default function DashboardPage() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [stats, setStats] = useState({
        totalRaces: 0,
        wins: 0,
        winRatio: 0,
        peakWpm: 0,
        averageWpm: 0,
    });

    const [joinCode, setJoinCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showJoinModal, setShowJoinModal] = useState(false);

    // Load user profile statistics from backend on page mount
    useEffect(() => {
        if (!user?.id) return;
        let active = true;

        const fetchStats = async () => {
            try {
                const res = await api.get(`/users/${user.id}/stats`);
                if (active && res.data?.success && res.data?.data) {
                    const s = res.data.data;
                    setStats({
                        totalRaces: s.totalRaces || 0,
                        wins: s.wins || 0,
                        winRatio: s.winRatio || 0,
                        peakWpm: s.peakWpm || 0,
                        averageWpm: s.averageWpm || 0,
                    });
                }
            } catch (err) {
                console.warn('Failed to retrieve user statistics from backend:', err.message);
            }
        };

        fetchStats();
        return () => {
            active = false;
        };
    }, [user?.id]);

    const handleCreateRoom = async () => {
        setError('');
        setLoading(true);

        try {
            // Create a room with default configurations
            const res = await api.post('/rooms', {
                configDuration: 30,
                configMode: 'WORDS',
            });

            if (res.data?.success && res.data?.data?.room) {
                const roomId = res.data.data.room.id;
                navigate(`/race/${roomId}`);
            } else {
                throw new Error('Create Room response did not contain room configurations.');
            }
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to create room.');
        } finally {
            setLoading(false);
        }
    };

    const handleJoinRoomSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const formattedCode = joinCode.trim().toUpperCase();
        if (!formattedCode) {
            setError('Please enter a room code.');
            return;
        }

        setLoading(true);
        try {
            const res = await api.post('/rooms/join', {
                code: formattedCode,
            });

            if (res.data?.success && res.data?.data?.room) {
                const roomId = res.data.data.room.id;
                navigate(`/race/${roomId}`);
            } else {
                throw new Error('Join Room response did not contain room configurations.');
            }
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Room not found or cannot be joined.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.page}>
            <div className="container">
                {/* Header */}
                <div className={styles.header}>
                    <div>
                        <h1 className={styles.title}>
                            Hey, {user?.username || 'Racer'} 🐼
                        </h1>
                        <p className={styles.sub}>Find a room or create a new race below.</p>
                    </div>
                    <div className={styles.headerActions}>
                        <button
                            onClick={() => navigate('/race/solo')}
                            className="btn btn-primary"
                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                            disabled={loading}
                        >
                            🐼 Solo Practice
                        </button>
                        <button
                            onClick={() => setShowJoinModal(true)}
                            className="btn btn-primary"
                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                            disabled={loading}
                        >
                            👥 Multiplayer Race
                        </button>
                    </div>
                </div>

                {error && (
                    <div role="alert" className={styles.errorBanner}>
                        ⚠ {error}
                    </div>
                )}

                {/* Stats row */}
                <div className={styles.statsRow}>
                    {[
                        { label: 'Level', value: user?.level ?? 1, icon: '⭐' },
                        { label: 'XP', value: user?.xp ?? 0, icon: '🎋' },
                        { label: 'Races', value: stats.totalRaces, icon: '🏁' },
                        { label: 'Wins', value: stats.wins, icon: '🥇' },
                        { label: 'Avg WPM', value: stats.averageWpm > 0 ? `${stats.averageWpm} WPM` : '—', icon: '⚡' },
                    ].map((s) => (
                        <div key={s.label} className={`card ${styles.statCard}`}>
                            <span className={styles.statIcon}>{s.icon}</span>
                            <span className={styles.statVal}>{s.value}</span>
                            <span className={styles.statLabel}>{s.label}</span>
                        </div>
                    ))}
                </div>

                {/* Multiplayer modal */}
                {showJoinModal && (
                    <div className={styles.modalOverlay} role="dialog" aria-modal="true">
                        <div className={`card ${styles.modalCard}`}>
                            <h2>Multiplayer Arena 👥</h2>
                            <p className={styles.modalSub}>Host a new competitive lobby or join an ongoing race.</p>

                            <div className={styles.modalBody}>
                                <button
                                    onClick={handleCreateRoom}
                                    className="btn btn-primary"
                                    style={{ width: '100%', marginBottom: '1.25rem', display: 'block' }}
                                    disabled={loading}
                                >
                                    {loading ? '🎋 Creating Room...' : '＋ Host New Lobby'}
                                </button>

                                <div className={styles.divider}>
                                    <span>or join with a code</span>
                                </div>

                                <form onSubmit={handleJoinRoomSubmit} className={styles.modalForm}>
                                    <input
                                        type="text"
                                        placeholder="ROOM CODE"
                                        maxLength={10}
                                        className="input-field code-font"
                                        style={{ textTransform: 'uppercase', fontSize: '1.2rem', textAlign: 'center', letterSpacing: '4px', marginBottom: '1rem', width: '100%' }}
                                        value={joinCode}
                                        onChange={(e) => setJoinCode(e.target.value)}
                                        disabled={loading}
                                    />
                                    <button
                                        type="submit"
                                        className="btn btn-ghost"
                                        style={{ width: '100%', marginBottom: '0.75rem', border: '1px solid var(--border)' }}
                                        disabled={loading}
                                    >
                                        {loading ? 'Joining...' : 'Join Lobby 🎋'}
                                    </button>
                                </form>

                                <button
                                    type="button"
                                    onClick={() => { setShowJoinModal(false); setJoinCode(''); setError(''); }}
                                    className="btn btn-ghost"
                                    style={{ width: '100%', color: 'var(--text-muted)' }}
                                    disabled={loading}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
