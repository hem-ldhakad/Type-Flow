// src/pages/SoloPracticePage.jsx
import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/axios';
import styles from './RacePage.module.css';
import SpeedChart from '../components/SpeedChart';

export default function SoloPracticePage() {
    const navigate = useNavigate();
    const { user } = useAuth();

    // Stage: LOADING → READY → COUNTDOWN → RACING → COMPLETE
    const [stage, setStage] = useState('LOADING');
    const [errorMsg, setErrorMsg] = useState('');

    // Word count preference state
    const [selectedWordCount, setSelectedWordCount] = useState(25);

    // Paragraph data
    const [paragraph, setParagraph] = useState('');
    const [paragraphId, setParagraphId] = useState(null);

    // Typing state
    const [typedText, setTypedText] = useState('');
    const [totalKeystrokes, setTotalKeystrokes] = useState(0);

    // Timing / live metrics
    const [matchStartTime, setMatchStartTime] = useState(null);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [localWpm, setLocalWpm] = useState(0);
    const [localAcc, setLocalAcc] = useState(100);
    const [wpmHistory, setWpmHistory] = useState([0]);

    // Countdown
    const [countdownSecs, setCountdownSecs] = useState(3);

    // Results
    const [result, setResult] = useState(null);

    const inputRef = useRef(null);

    // 1. Fetch a random paragraph depending on wordCount selection
    useEffect(() => {
        let active = true;

        const fetchParagraph = async () => {
            setStage('LOADING');
            try {
                const res = await api.get(`/matches/paragraph/random?wordCount=${selectedWordCount}`);
                if (active && res.data?.success && res.data?.data?.paragraph) {
                    const p = res.data.data.paragraph;
                    setParagraph(p.content || p.text || '');
                    setParagraphId(p.id);
                    setStage('READY');
                } else {
                    throw new Error('No paragraphs available.');
                }
            } catch (err) {
                if (active) {
                    setErrorMsg(err.response?.data?.message || err.message || 'Failed to load paragraph.');
                }
            }
        };

        fetchParagraph();
        return () => { active = false; };
    }, [selectedWordCount]);

    // 2. Countdown timer
    const startCountdown = useCallback(() => {
        setStage('COUNTDOWN');
        setCountdownSecs(3);

        let secs = 3;
        const interval = setInterval(() => {
            secs -= 1;
            if (secs <= 0) {
                clearInterval(interval);
                setStage('RACING');
                setMatchStartTime(Date.now());
                setTypedText('');
                setTotalKeystrokes(0);
                setLocalWpm(0);
                setLocalAcc(100);
                setElapsedTime(0);
                setWpmHistory([0]);
            } else {
                setCountdownSecs(secs);
            }
        }, 1000);
    }, []);

    // Autofocus input when RACING starts
    useEffect(() => {
        if (stage === 'RACING' && inputRef.current) {
            inputRef.current.focus();
        }
    }, [stage]);

    // Live timer tick during RACING
    useEffect(() => {
        if (stage !== 'RACING' || !matchStartTime) return;

        const interval = setInterval(() => {
            const seconds = (Date.now() - matchStartTime) / 1000;
            setElapsedTime(Math.round(seconds));

            const secondIndex = Math.max(1, Math.floor(seconds));

            setTypedText((currText) => {
                let correctPrefix = 0;
                for (let i = 0; i < currText.length; i++) {
                    if (currText[i] === paragraph[i]) {
                        correctPrefix++;
                    } else {
                        break;
                    }
                }

                let currentWpm = 0;
                if (seconds > 0.5) {
                    currentWpm = Math.round((correctPrefix / 5) / (seconds / 60));
                    setLocalWpm(currentWpm);
                }

                setWpmHistory((prev) => {
                    const nextHist = [...prev];
                    while (nextHist.length <= secondIndex) {
                        nextHist.push(currentWpm);
                    }
                    nextHist[secondIndex] = currentWpm;
                    return nextHist;
                });

                return currText;
            });
        }, 100);

        return () => clearInterval(interval);
    }, [stage, matchStartTime, paragraph]);

    // Handle input change & detect finish
    const handleInputChange = (e) => {
        if (stage !== 'RACING') return;

        const val = e.target.value;
        if (val.length > paragraph.length) return;

        setTypedText(val);

        // Calculate correct length
        let correctLen = 0;
        for (let i = 0; i < val.length; i++) {
            if (val[i] === paragraph[i]) {
                correctLen++;
            } else {
                break;
            }
        }

        // Live accuracy update
        setTotalKeystrokes((prevKeys) => {
            const nextKeys = Math.max(prevKeys, correctLen);
            const acc = nextKeys > 0 ? Math.round((correctLen / nextKeys) * 100) : 100;
            setLocalAcc(acc);
            return prevKeys;
        });

        // Check for finish (entire paragraph typed correctly)
        if (correctLen === paragraph.length) {
            finishMatch(correctLen);
        }
    };

    const handleInputKeyDown = (e) => {
        if (e.key.length === 1) {
            setTotalKeystrokes((prev) => prev + 1);
        }
    };

    // Submit solo match results
    const finishMatch = async (correctLen) => {
        const seconds = (Date.now() - matchStartTime) / 1000;
        const finalWpm = seconds > 0 ? Math.round((correctLen / 5) / (seconds / 60)) : 0;
        const finalAcc = totalKeystrokes > 0 ? Math.round((correctLen / totalKeystrokes) * 100) : 100;

        // Force-refresh and fill final history datapoint
        const finalHistory = [...wpmHistory];
        const lastIdx = Math.max(1, Math.floor(seconds));
        while (finalHistory.length <= lastIdx) {
            finalHistory.push(finalWpm);
        }
        finalHistory[lastIdx] = finalWpm;

        setLocalWpm(finalWpm);
        setLocalAcc(finalAcc);
        setWpmHistory(finalHistory);
        setStage('COMPLETE');

        try {
            const res = await api.post('/matches/solo', {
                paragraphId,
                wpm: finalWpm,
                accuracy: finalAcc,
                wpmHistory: finalHistory,
            });

            if (res.data?.success && res.data?.data) {
                setResult(res.data.data);
            }
        } catch (err) {
            console.warn('Failed to save solo match:', err.message);
        }
    };

    // Render character validation grid
    const renderParagraph = () => {
        if (!paragraph) return null;

        return paragraph.split('').map((char, index) => {
            let charClass = styles.charUpcoming;
            if (index < typedText.length) {
                if (typedText[index] === paragraph[index]) {
                    charClass = styles.charCorrect;
                } else {
                    charClass = styles.charIncorrect;
                }
            }

            const isCursor = index === typedText.length;

            return (
                <span key={index} className={`${charClass} ${isCursor ? styles.cursor : ''}`}>
                    {char}
                </span>
            );
        });
    };

    // Loading state
    if (stage === 'LOADING' && !errorMsg) {
        return (
            <div className={styles.loadingPage}>
                <div className={styles.loadingWrapper}>
                    <span className={styles.loadingIcon}>🐼</span>
                    <p>Loading practice paragraph...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (errorMsg) {
        return (
            <div className={styles.errorPage}>
                <div className={`card ${styles.errorCard}`}>
                    <h2>Solo Practice Error</h2>
                    <p>{errorMsg}</p>
                    <button onClick={() => navigate('/dashboard')} className="btn btn-primary">
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <div className="container">
                {/* Header */}
                <div className={styles.raceHeader}>
                    <div>
                        <span className={`badge ${stage === 'RACING' ? 'badge-pink' : 'badge-green'} ${styles.liveBadge}`}>
                            {stage === 'READY' && '🐼 SOLO PRACTICE'}
                            {stage === 'COUNTDOWN' && '⏳ PREPARING...'}
                            {stage === 'RACING' && '🏁 TYPING'}
                            {stage === 'COMPLETE' && '🥇 COMPLETE'}
                        </span>
                        <h1 className={styles.title}>Solo Practice 🐼</h1>
                    </div>
                    <button onClick={() => navigate('/dashboard')} className="btn btn-ghost">
                        ← Back to Dashboard
                    </button>
                </div>

                {/* READY → Start Button */}
                {stage === 'READY' && (
                    <div className={styles.lobbyLayout}>
                        <div className={`card ${styles.lobbyCard}`}>
                            <div className={styles.lobbyCardHeader}>
                                <h2>Ready to Practice?</h2>
                            </div>
                            <div className={styles.playerList}>
                                <div className={styles.playerRow}>
                                    <div className={styles.playerMeta}>
                                        <span className={styles.avatar}>
                                            {user?.username?.[0]?.toUpperCase() || '🐼'}
                                        </span>
                                        <span className={styles.playerName}>
                                            {user?.username} <span className={styles.youTag}>(You)</span>
                                        </span>
                                    </div>
                                    <div className={styles.playerState}>
                                        <span className={styles.readyBadge}>🐼 Solo</span>
                                    </div>
                                </div>
                            </div>

                            {/* Word Count Selector for Solo Practice */}
                            <div style={{ margin: '1.5rem 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main, #333333)' }}>
                                    Select Word Limit:
                                </label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {[10, 25, 50, 100].map((size) => (
                                        <button
                                            key={size}
                                            type="button"
                                            className={`btn ${selectedWordCount === size ? 'btn-primary' : 'btn-ghost'}`}
                                            onClick={() => setSelectedWordCount(size)}
                                            style={{
                                                flex: 1,
                                                padding: '10px 6px',
                                                fontSize: '0.85rem',
                                                border: selectedWordCount === size ? 'none' : '1px solid var(--border-color, #eef2f6)'
                                            }}
                                        >
                                            ⚡ {size} Words
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className={styles.lobbyActions}>
                                <button
                                    onClick={startCountdown}
                                    className={`btn btn-primary ${styles.readyBtn}`}
                                >
                                    Start Practice 🎋
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* COUNTDOWN */}
                {stage === 'COUNTDOWN' && (
                    <div className={styles.lobbyLayout}>
                        <div className={`card ${styles.countdownCard}`}>
                            <div className={styles.countdownPanda}>🐼</div>
                            <div className={styles.countdownSecs}>{countdownSecs}</div>
                            <p>Get ready to type!</p>
                        </div>
                    </div>
                )}

                {/* RACING */}
                {stage === 'RACING' && (
                    <div className={styles.raceLayout}>
                        {/* Progress */}
                        <div className={`card ${styles.progressCard}`}>
                            <h2 className={styles.sectionLabel}>Your Progress</h2>
                            <div className={styles.racerContainer}>
                                <div className={styles.racer}>
                                    <div className={styles.racerMeta}>
                                        <span className={styles.racerName}>
                                            🐼 {user?.username}
                                            <span className={`badge badge-green ${styles.youBadge}`}>You</span>
                                        </span>
                                        <span className={styles.racerWpm}>
                                            {localWpm > 0 ? `${localWpm} WPM` : '0 WPM'}
                                        </span>
                                    </div>
                                    <div className={styles.bar}>
                                        <div
                                            className={styles.barFill}
                                            style={{
                                                width: `${paragraph.length > 0 ? Math.round((typedText.length / paragraph.length) * 100) : 0}%`
                                            }}
                                        />
                                        <span
                                            className={styles.panda}
                                            style={{
                                                left: `${paragraph.length > 0 ? Math.round((typedText.length / paragraph.length) * 100) : 0}%`
                                            }}
                                        >
                                            🐼
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Typing Card */}
                        <div className={`card ${styles.typingCard}`}>
                            <div className={styles.paragraphContainer}>
                                {renderParagraph()}
                            </div>

                            <textarea
                                ref={inputRef}
                                id="solo-input"
                                className={`input-field ${styles.typingInput}`}
                                placeholder="Type the text exactly as shown..."
                                rows={3}
                                value={typedText}
                                onChange={handleInputChange}
                                onKeyDown={handleInputKeyDown}
                            />

                            <div className={styles.typingFooter}>
                                <span className={styles.timer}>
                                    Time: <strong>{elapsedTime}s</strong>
                                </span>
                                <div className={styles.liveStats}>
                                    <span>WPM: <strong>{localWpm}</strong></span>
                                    <span>ACC: <strong>{localAcc}%</strong></span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* COMPLETE */}
                {stage === 'COMPLETE' && (
                    <div style={{ maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
                        {/* Title Banner */}
                        <div style={{
                            textAlign: 'center',
                            marginBottom: '1.75rem'
                        }}>
                            <span style={{ fontSize: '2.5rem' }}>🏆</span>
                            <h2 style={{ margin: '0.25rem 0 0.5rem', fontSize: '1.75rem', fontWeight: 700 }}>
                                Practice Complete!
                            </h2>
                            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.95rem' }}>
                                Here's how you performed — {selectedWordCount} words
                            </p>
                        </div>

                        {/* Side-by-Side Layout */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '340px 1fr',
                            gap: '1.5rem',
                            alignItems: 'start'
                        }}>
                            {/* LEFT — Stats Panel */}
                            <div className="card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '0' }}>
                                {/* Big WPM Spotlight */}
                                <div style={{
                                    textAlign: 'center',
                                    padding: '1.5rem 0 1.25rem',
                                    borderBottom: '1px solid var(--border-color, #eef2f6)',
                                    marginBottom: '1.25rem'
                                }}>
                                    <div style={{ fontSize: '3.5rem', fontWeight: 800, lineHeight: 1, background: 'linear-gradient(135deg, #ec4899, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                        {localWpm}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '4px' }}>
                                        Words Per Minute
                                    </div>
                                </div>

                                {/* Stat Rows */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                                    {[
                                        { icon: '🎯', label: 'Accuracy', value: `${localAcc}%`, color: localAcc >= 95 ? '#10b981' : localAcc >= 80 ? '#f59e0b' : '#ef4444' },
                                        { icon: '⏱️', label: 'Time', value: `${elapsedTime}s`, color: 'var(--text-main)' },
                                        { icon: '📝', label: 'Words', value: `${selectedWordCount} words`, color: 'var(--text-main)' },
                                        ...(result ? [{ icon: '🎋', label: 'XP Gained', value: `+${result.xpGained} XP`, color: '#8b5cf6' }] : [])
                                    ].map((stat) => (
                                        <div key={stat.label} style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '0.6rem 0.75rem',
                                            background: 'var(--surface-bg, #f9fafb)',
                                            borderRadius: '10px',
                                        }}>
                                            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span>{stat.icon}</span> {stat.label}
                                            </span>
                                            <strong style={{ fontSize: '0.95rem', color: stat.color }}>{stat.value}</strong>
                                        </div>
                                    ))}
                                </div>

                                {/* Level/XP Progress if result available */}
                                {result && (
                                    <div style={{ marginBottom: '1.25rem', padding: '0.75rem', background: 'linear-gradient(135deg, rgba(236,72,153,0.07), rgba(139,92,246,0.07))', borderRadius: '10px', border: '1px solid rgba(139,92,246,0.15)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '6px' }}>
                                            <span style={{ fontWeight: 600, color: '#8b5cf6' }}>Level {result.currentLevel}</span>
                                            <span style={{ color: 'var(--text-muted)' }}>{result.currentXp} / {result.currentLevel * 100} XP</span>
                                        </div>
                                        <div style={{ height: '6px', background: 'var(--border-color, #eef2f6)', borderRadius: '99px', overflow: 'hidden' }}>
                                            <div style={{
                                                height: '100%',
                                                width: `${Math.min(100, (result.currentXp / (result.currentLevel * 100)) * 100)}%`,
                                                background: 'linear-gradient(90deg, #ec4899, #8b5cf6)',
                                                borderRadius: '99px',
                                                transition: 'width 0.5s ease'
                                            }} />
                                        </div>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <button
                                        onClick={() => window.location.reload()}
                                        className="btn btn-primary"
                                        style={{ width: '100%', justifyContent: 'center' }}
                                    >
                                        🔄 Practice Again
                                    </button>
                                    <button
                                        onClick={() => navigate('/dashboard')}
                                        className="btn btn-ghost"
                                        style={{ width: '100%', justifyContent: 'center' }}
                                    >
                                        ← Return to Dashboard
                                    </button>
                                </div>
                            </div>

                            {/* RIGHT — WPM Chart */}
                            <div className="card" style={{ padding: '1.75rem' }}>
                                <div style={{ marginBottom: '1rem' }}>
                                    <h3 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 700 }}>
                                        📈 Speed Over Time
                                    </h3>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        Your WPM progression throughout the session
                                    </p>
                                </div>
                                <SpeedChart wpmHistory={wpmHistory} userName={user?.username} />

                                {/* Mini insight bar */}
                                {wpmHistory.length > 2 && (
                                    <div style={{
                                        display: 'flex',
                                        gap: '1rem',
                                        marginTop: '1.25rem',
                                        paddingTop: '1.25rem',
                                        borderTop: '1px solid var(--border-color, #eef2f6)'
                                    }}>
                                        {[
                                            { label: 'Start WPM', value: wpmHistory[1] || 0, color: '#8b5cf6' },
                                            { label: 'Avg WPM', value: Math.round(wpmHistory.reduce((a, b) => a + b, 0) / wpmHistory.length), color: '#6366f1' },
                                            { label: 'Peak WPM', value: Math.max(...wpmHistory), color: '#ec4899' },
                                            { label: 'Final WPM', value: localWpm, color: '#10b981' }
                                        ].map(stat => (
                                            <div key={stat.label} style={{ flex: 1, textAlign: 'center' }}>
                                                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: stat.color }}>{stat.value}</div>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500, marginTop: '2px' }}>{stat.label}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
