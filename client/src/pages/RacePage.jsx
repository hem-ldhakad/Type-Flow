// src/pages/RacePage.jsx
import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import api from '../api/axios';
import styles from './RacePage.module.css';

export default function RacePage() {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { emit, on, off, connected } = useSocket();

    // Room metadata from database
    const [dbRoom, setDbRoom] = useState(null);

    // Realtime in-memory room states synced via Websockets
    const [members, setMembers] = useState([]);
    const [isSoloMode, setIsSoloMode] = useState(false);
    const [roomStatus, setRoomStatus] = useState('LOBBY'); // LOBBY, COUNTDOWN, RACING, COMPLETE
    const [countdownSecs, setCountdownSecs] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [apiLoading, setApiLoading] = useState(true);

    // Match typing variables
    const [paragraph, setParagraph] = useState('');
    const [paragraphId, setParagraphId] = useState(null);

    // User typing inputs
    const [typedText, setTypedText] = useState('');
    const [totalKeystrokes, setTotalKeystrokes] = useState(0);

    // Timing/Stats states
    const [matchStartTime, setMatchStartTime] = useState(null);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [localWpm, setLocalWpm] = useState(0);
    const [localAcc, setLocalAcc] = useState(100);

    // Standings results array
    const [matchResults, setMatchResults] = useState([]);

    // DOM Refs
    const inputRef = useRef(null);
    const joinedRef = useRef(false);

    // 1. Leave room action
    const handleLeaveRoom = useCallback(async () => {
        try {
            emit('leave-room', { roomId });
            await api.post(`/rooms/${roomId}/leave`);
        } catch (err) {
            console.warn('REST logout warning:', err.message);
        } finally {
            navigate('/dashboard', { replace: true });
        }
    }, [roomId, emit, navigate]);

    // 2. Fetch room info from REST API database on mount
    useEffect(() => {
        let active = true;

        const loadRoomData = async () => {
            try {
                const res = await api.get(`/rooms/${roomId}`);
                if (active && res.data?.success && res.data?.data?.room) {
                    setDbRoom(res.data.data.room);
                    setRoomStatus(res.data.data.room.status);
                } else {
                    throw new Error('Room not valid.');
                }
            } catch (err) {
                if (active) {
                    setErrorMsg(err.response?.data?.message || err.message || 'Room initialization failed.');
                }
            } finally {
                if (active) setApiLoading(false);
            }
        };

        loadRoomData();

        return () => {
            active = false;
        };
    }, [roomId]);

    // 3. Bind socket connection event handlers once socket connects
    useEffect(() => {
        if (!connected || apiLoading || errorMsg) return;

        // Send join room request
        if (!joinedRef.current) {
            emit('join-room', { roomId });
            joinedRef.current = true;
        }

        const handleRoomJoined = (payload) => {
            console.log('[Socket] room-joined:', payload);
            setMembers(payload.members || []);
            setIsSoloMode(!!payload.isSolo);
            setRoomStatus('LOBBY');
            setErrorMsg('');
        };

        const handleRoomModeUpdated = (payload) => {
            console.log('[Socket] room-mode-updated:', payload);
            setIsSoloMode(!!payload.isSolo);
        };

        const handlePlayerJoined = (payload) => {
            console.log('[Socket] player-joined:', payload);
            setMembers((prev) => {
                if (prev.some((m) => m.userId === payload.userId)) return prev;
                return [...prev, {
                    userId: payload.userId,
                    username: payload.username,
                    isReady: false,
                    progress: 0,
                    wpm: 0,
                    accuracy: 100,
                    finished: false
                }];
            });
        };

        const handlePlayerLeft = (payload) => {
            console.log('[Socket] player-left:', payload);
            setMembers((prev) => prev.filter((m) => m.userId !== payload.userId));
        };

        const handlePlayerReadyStatus = (payload) => {
            console.log('[Socket] player-ready-status:', payload);
            setMembers((prev) =>
                prev.map((m) =>
                    m.userId === payload.userId ? { ...m, isReady: payload.isReady } : m
                )
            );
        };

        const handleCountdown = (payload) => {
            console.log('[Socket] countdown:', payload);
            setRoomStatus('COUNTDOWN');
            setCountdownSecs(payload.timeRemaining);
        };

        const handleCountdownCancelled = (payload) => {
            console.log('[Socket] countdown-cancelled:', payload);
            setRoomStatus('LOBBY');
            setCountdownSecs(null);
            setErrorMsg(`Countdown reset: ${payload.reason || 'Player left or became unready'}`);
            setTimeout(() => setErrorMsg(''), 4000);
        };

        const handleHostMigrated = (payload) => {
            console.log('[Socket] host-migrated:', payload);
            if (dbRoom) {
                setDbRoom((prev) => ({ ...prev, hostId: payload.newHostId }));
            }
        };

        const handleGameStart = (payload) => {
            console.log('[Socket] game-start:', payload);
            setRoomStatus('RACING');
            setParagraph(payload.paragraphText);
            setParagraphId(payload.paragraphId);
            setCountdownSecs(null);
            setTypedText('');
            setTotalKeystrokes(0);
            setLocalWpm(0);
            setLocalAcc(100);
            setElapsedTime(0);
            setMatchStartTime(Date.now());
        };

        const handleProgressUpdate = (payload) => {
            setMembers((prev) =>
                prev.map((m) =>
                    m.userId === payload.userId
                        ? { ...m, progress: payload.progressPercentage, wpm: payload.currentWpm }
                        : m
                )
            );
        };

        const handlePlayerFinished = (payload) => {
            console.log('[Socket] player-finished:', payload);
            setMembers((prev) =>
                prev.map((m) =>
                    m.userId === payload.userId
                        ? { ...m, finished: true, rank: payload.rank, wpm: payload.wpm }
                        : m
                )
            );
        };

        const handleGameEnd = (payload) => {
            console.log('[Socket] game-end:', payload);
            setRoomStatus('COMPLETE');
            setMatchResults(payload.results || []);
        };

        const handleSocketError = (payload) => {
            console.error('[Socket] error event:', payload);
            setErrorMsg(payload.message || 'A socket error occurred.');
        };

        // Bind event hooks
        on('room-joined', handleRoomJoined);
        on('room-mode-updated', handleRoomModeUpdated);
        on('player-joined', handlePlayerJoined);
        on('player-left', handlePlayerLeft);
        on('player-ready-status', handlePlayerReadyStatus);
        on('countdown', handleCountdown);
        on('countdown-cancelled', handleCountdownCancelled);
        on('host-migrated', handleHostMigrated);
        on('game-start', handleGameStart);
        on('progress-update', handleProgressUpdate);
        on('player-finished', handlePlayerFinished);
        on('game-end', handleGameEnd);
        on('error', handleSocketError);

        return () => {
            // Reset join tracker on unmount/disconnect to enable rejoining on reconnect restoration
            joinedRef.current = false;
            off('room-joined', handleRoomJoined);
            off('room-mode-updated', handleRoomModeUpdated);
            off('player-joined', handlePlayerJoined);
            off('player-left', handlePlayerLeft);
            off('player-ready-status', handlePlayerReadyStatus);
            off('countdown', handleCountdown);
            off('countdown-cancelled', handleCountdownCancelled);
            off('host-migrated', handleHostMigrated);
            off('game-start', handleGameStart);
            off('progress-update', handleProgressUpdate);
            off('player-finished', handlePlayerFinished);
            off('game-end', handleGameEnd);
            off('error', handleSocketError);
        };
    }, [connected, apiLoading, errorMsg, roomId, dbRoom, on, off, emit]);

    // Autofocus input box when RACING starts
    useEffect(() => {
        if (roomStatus === 'RACING' && inputRef.current) {
            inputRef.current.focus();
        }
    }, [roomStatus]);

    // Live timer tick and metrics updates during RACING status
    useEffect(() => {
        if (roomStatus !== 'RACING' || !matchStartTime) return;

        const interval = setInterval(() => {
            const seconds = (Date.now() - matchStartTime) / 1000;
            setElapsedTime(Math.round(seconds));

            // Calculate correct prefix length to update WPM
            const myMember = members.find((m) => m.userId === user?.id);
            if (myMember && myMember.finished) {
                clearInterval(interval);
                return;
            }

            // Live metrics calculations
            setTypedText((currText) => {
                let correctPrefix = 0;
                for (let i = 0; i < currText.length; i++) {
                    if (currText[i] === paragraph[i]) {
                        correctPrefix++;
                    } else {
                        break;
                    }
                }

                if (seconds > 0.5) {
                    const wpm = Math.round((correctPrefix / 5) / (seconds / 60));
                    setLocalWpm(wpm);
                }
                return currText;
            });
        }, 100);

        return () => clearInterval(interval);
    }, [roomStatus, matchStartTime, paragraph, members, user?.id]);

    // 4. Toggle ready indicator function
    const handleToggleReady = () => {
        const myMember = members.find((m) => m.userId === user?.id);
        if (!myMember) return;

        emit('ready', {
            roomId,
            isReady: !myMember.isReady,
        });
    };

    // 5. Track input change & emit Socket typing events
    const handleInputChange = (e) => {
        if (roomStatus !== 'RACING') return;

        const val = e.target.value;

        // Prevent typing further than paragraph size
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

            // Emit events to socket
            emit('typing', {
                roomId,
                typedText: val,
                totalKeystrokes: nextKeys,
            });

            return prevKeys;
        });
    };

    // Counter for character keys
    const handleInputKeyDown = (e) => {
        if (e.key.length === 1) {
            setTotalKeystrokes((prev) => prev + 1);
        }
    };

    // Render character validation grid
    const renderParagraph = () => {
        if (!paragraph) return null;

        // Determine correct typed prefix boundary
        let correctLen = 0;
        for (let i = 0; i < typedText.length; i++) {
            if (typedText[i] === paragraph[i]) {
                correctLen++;
            } else {
                break;
            }
        }

        return paragraph.split('').map((char, index) => {
            let charClass = styles.charUpcoming;
            if (index < correctLen) {
                charClass = styles.charCorrect;
            } else if (index < typedText.length) {
                charClass = styles.charIncorrect;
            }

            const isCursor = index === typedText.length;

            return (
                <span key={index} className={`${charClass} ${isCursor ? styles.cursor : ''}`}>
                    {char}
                </span>
            );
        });
    };

    const isMeHost = dbRoom?.hostId === user?.id;
    const myMember = members.find((m) => m.userId === user?.id);
    const isMeReady = !!myMember?.isReady;
    const currentRacerFinished = !!myMember?.finished;

    // Render Loader
    if (apiLoading) {
        return (
            <div className={styles.loadingPage}>
                <div className={styles.loadingWrapper}>
                    <span className={styles.loadingIcon}>🎋</span>
                    <p>Analyzing lobby data...</p>
                </div>
            </div>
        );
    }

    // Render Error
    if (errorMsg && !dbRoom) {
        return (
            <div className={styles.errorPage}>
                <div className={`card ${styles.errorCard}`}>
                    <h2>Lobby Error</h2>
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
                {/* Connection Loss Alert */}
                {!connected && (
                    <div className={styles.connectionAlert} role="alert">
                        ⚠️ Connection lost. Reconnecting to race server...
                    </div>
                )}

                {/* Race header */}
                <div className={styles.raceHeader}>
                    <div>
                        <span className={`badge ${roomStatus === 'RACING' ? 'badge-pink' : 'badge-green'} ${styles.liveBadge}`}>
                            {roomStatus === 'LOBBY' && '🎋 WAITING FOR PLAYERS'}
                            {roomStatus === 'COUNTDOWN' && '⏳ PREPARING...'}
                            {roomStatus === 'RACING' && '🏁 RACING'}
                            {roomStatus === 'COMPLETE' && '🥇 COMPLETE'}
                        </span>
                        <h1 className={styles.title}>
                            Room Code: <span className="code-font">{dbRoom?.code}</span>
                        </h1>
                    </div>
                    <button onClick={handleLeaveRoom} className="btn btn-ghost">
                        ← Leave Room
                    </button>
                </div>

                {errorMsg && (
                    <div className={styles.errorToast} role="alert">
                        ⚠ {errorMsg}
                    </div>
                )}

                {/* ── Lobby Waiting / Countdown Screen ── */}
                {(roomStatus === 'LOBBY' || roomStatus === 'COUNTDOWN') && (
                    <div className={styles.lobbyLayout}>
                        {/* Player Checklist Card */}
                        <div className={`card ${styles.lobbyCard}`}>
                            <div className={styles.lobbyCardHeader}>
                                <h2>Lobby Competitors ({members.length})</h2>
                                {isMeHost && <span className={styles.hostNotice}>You are Host 👑</span>}
                            </div>

                            <div className={styles.playerList}>
                                {members.map((m) => {
                                    const isHost = dbRoom?.hostId === m.userId;
                                    const isCurrentPl = m.userId === user?.id;

                                    return (
                                        <div key={m.userId} className={styles.playerRow}>
                                            <div className={styles.playerMeta}>
                                                <span className={styles.avatar}>
                                                    {m.username?.[0]?.toUpperCase() || '🐼'}
                                                </span>
                                                <span className={styles.playerName}>
                                                    {m.username} {isCurrentPl && <span className={styles.youTag}>(You)</span>}
                                                </span>
                                                {isHost && <span className={styles.hostBadge}>Host</span>}
                                            </div>

                                            <div className={styles.playerState}>
                                                {m.isReady ? (
                                                    <span className={styles.readyBadge}>✓ Ready</span>
                                                ) : (
                                                    <span className={styles.notReadyBadge}>⏳ Waiting</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Ready Action Buttons */}
                            <div className={styles.lobbyActions}>
                                {members.length < 2 ? (
                                    <p className={styles.waitingTip}>
                                        👥 Multiplayer mode requires at least 2 players. Ready Up will unlock when another player joins.
                                    </p>
                                ) : (
                                    <button
                                        onClick={handleToggleReady}
                                        className={`btn ${isMeReady ? 'btn-ghost' : 'btn-primary'} ${styles.readyBtn}`}
                                    >
                                        {isMeReady ? 'Unready ❌' : 'Ready Up 🎋'}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Countdown Overlay */}
                        {roomStatus === 'COUNTDOWN' && (
                            <div className={`card ${styles.countdownCard}`}>
                                <div className={styles.countdownPanda}>🐼</div>
                                <div className={styles.countdownSecs}>{countdownSecs}</div>
                                <p>Prepare to type! Every competitor is ready!</p>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Active Typing / Race View Screen ── */}
                {roomStatus === 'RACING' && (
                    <div className={styles.raceLayout}>
                        {/* Competitor Standings / Progress Bars */}
                        <div className={`card ${styles.progressCard}`}>
                            <h2 className={styles.sectionLabel}>Competitors Progress</h2>
                            <div className={styles.racerContainer}>
                                {members.map((m) => {
                                    const isCurrentPl = m.userId === user?.id;
                                    return (
                                        <div key={m.userId} className={styles.racer}>
                                            <div className={styles.racerMeta}>
                                                <span className={styles.racerName}>
                                                    {isCurrentPl ? '🐼 ' : ''}{m.username}
                                                    {isCurrentPl && <span className={`badge badge-green ${styles.youBadge}`}>You</span>}
                                                    {m.finished && <span className={styles.finishedMarker}>✓ Finished</span>}
                                                </span>
                                                <span className={styles.racerWpm}>
                                                    {m.wpm > 0 ? `${m.wpm} WPM` : '0 WPM'}
                                                </span>
                                            </div>
                                            <div className={styles.bar}>
                                                <div
                                                    className={styles.barFill}
                                                    style={{ width: `${m.progress || 0}%` }}
                                                />
                                                <span className={styles.panda} style={{ left: `${m.progress || 0}%` }}>🐼</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Main typing card */}
                        <div className={`card ${styles.typingCard}`}>
                            <div className={styles.paragraphContainer}>
                                {renderParagraph()}
                            </div>

                            <textarea
                                ref={inputRef}
                                id="race-input"
                                className={`input-field ${styles.typingInput}`}
                                placeholder={currentRacerFinished ? "You finished! Waiting for other racers..." : "Type the text exactly as shown..."}
                                rows={3}
                                value={typedText}
                                onChange={handleInputChange}
                                onKeyDown={handleInputKeyDown}
                                disabled={currentRacerFinished}
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

                {/* ── Game End Standings / Leaderboard persistence screen ── */}
                {roomStatus === 'COMPLETE' && (
                    <div className={styles.completeLayout}>
                        <div className={`card ${styles.resultsCard}`}>
                            <div className={styles.resultsHeader}>
                                <span className={styles.trophy}>🏆</span>
                                <h2>Match Completed!</h2>
                                <p>Persistent results are stored. Here is the leaderboard:</p>
                            </div>

                            <table className={styles.resultsTable}>
                                <thead>
                                    <tr>
                                        <th>Rank</th>
                                        <th>Competitor</th>
                                        <th>Speed (WPM)</th>
                                        <th>Accuracy</th>
                                        <th>XP Added</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {matchResults.map((r) => {
                                        const isCurrentPl = r.userId === user?.id;
                                        const baseXP = 20;
                                        const winnerXP = r.position === 1 ? 50 : 0;
                                        const speedXP = Math.floor(r.wpm / 5);
                                        const xpGained = baseXP + winnerXP + speedXP;

                                        return (
                                            <tr key={r.userId} className={isCurrentPl ? styles.highlightRow : ''}>
                                                <td>
                                                    <strong>#{r.position}</strong>
                                                </td>
                                                <td>
                                                    {r.username} {isCurrentPl && <span className={styles.tableYouTag}>(You)</span>}
                                                </td>
                                                <td className="code-font">{r.wpm} WPM</td>
                                                <td>{r.accuracy}%</td>
                                                <td className={styles.xpText}>+{xpGained} XP 🎋</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            <div className={styles.resultsActions}>
                                <button
                                    onClick={() => navigate('/dashboard')}
                                    className="btn btn-primary"
                                >
                                    Return to Dashboard
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
