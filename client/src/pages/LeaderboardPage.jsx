// src/pages/LeaderboardPage.jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/axios';
import styles from './LeaderboardPage.module.css';

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function LeaderboardPage() {
    const { user, isAuthenticated } = useAuth();
    const [period, setPeriod] = useState('all');
    const [board, setBoard] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        setLoading(true);
        setError('');

        api.get(`/users/leaderboard?period=${period}`)
            .then((res) => {
                if (active && res.data?.success) {
                    setBoard(res.data.data.leaderboard || []);
                }
            })
            .catch((err) => {
                if (active) setError(err.response?.data?.message || 'Failed to load leaderboard.');
            })
            .finally(() => { if (active) setLoading(false); });

        return () => { active = false; };
    }, [period]);

    return (
        <div className={styles.page}>
            <div className="container">
                {/* Page header */}
                <div className={styles.header}>
                    <div>
                        <h1 className={styles.title}>🏆 Leaderboard</h1>
                        <p className={styles.sub}>Top 50 racers ranked by average WPM</p>
                    </div>
                    <div className={styles.tabs}>
                        <button
                            className={`${styles.tab} ${period === 'all' ? styles.tabActive : ''}`}
                            onClick={() => setPeriod('all')}
                        >
                            🌍 Global All-Time
                        </button>
                        <button
                            className={`${styles.tab} ${period === 'week' ? styles.tabActive : ''}`}
                            onClick={() => setPeriod('week')}
                        >
                            📅 This Week
                        </button>
                    </div>
                </div>

                {/* Top 3 podium */}
                {!loading && !error && board.length >= 3 && (
                    <div className={styles.podium}>
                        {[board[1], board[0], board[2]].filter(Boolean).map((p, i) => {
                            const podiumOrder = [2, 1, 3];
                            const rank = podiumOrder[i];
                            return (
                                <div key={p.userId} className={`${styles.podiumSlot} ${styles[`podium${rank}`]}`}>
                                    <span className={styles.podiumMedal}>{MEDAL[rank]}</span>
                                    <Link to={`/profile/${p.userId}`} className={styles.podiumName}>
                                        {p.username}
                                    </Link>
                                    <span className={styles.podiumWpm}>{p.avgWpm} WPM</span>
                                    <span className={styles.podiumLevel}>Lvl {p.level}</span>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Full table */}
                <div className={`card ${styles.tableCard}`}>
                    {loading && (
                        <div className={styles.loadingState}>
                            <span className={styles.loadingIcon}>🎋</span>
                            <p>Loading rankings...</p>
                        </div>
                    )}

                    {error && !loading && (
                        <div className={styles.errorState}>⚠ {error}</div>
                    )}

                    {!loading && !error && board.length === 0 && (
                        <div className={styles.emptyState}>
                            <span>🐼</span>
                            <p>No races recorded {period === 'week' ? 'this week' : 'yet'}. Be the first!</p>
                        </div>
                    )}

                    {!loading && !error && board.length > 0 && (
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th style={{ width: 60 }}>Rank</th>
                                    <th>Player</th>
                                    <th>Level</th>
                                    <th>Avg WPM</th>
                                    <th>Peak WPM</th>
                                    <th>Races</th>
                                    <th>Wins</th>
                                </tr>
                            </thead>
                            <tbody>
                                {board.map((p) => {
                                    const isMe = isAuthenticated && user?.id === p.userId;
                                    return (
                                        <tr
                                            key={p.userId}
                                            className={`${p.rank <= 3 ? styles[`top${p.rank}`] : ''} ${isMe ? styles.meRow : ''}`}
                                        >
                                            <td className={styles.rankCell}>
                                                {MEDAL[p.rank] || <span className={styles.rankNum}>#{p.rank}</span>}
                                            </td>
                                            <td>
                                                <Link to={`/profile/${p.userId}`} className={styles.playerLink}>
                                                    {p.username}
                                                </Link>
                                                {isMe && <span className={styles.youBadge}>You</span>}
                                            </td>
                                            <td>
                                                <span className="badge badge-green">Lvl {p.level}</span>
                                            </td>
                                            <td className={styles.wpmCell}>{p.avgWpm}</td>
                                            <td className={styles.peakCell}>{p.peakWpm}</td>
                                            <td>{p.totalRaces}</td>
                                            <td>{p.wins}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
