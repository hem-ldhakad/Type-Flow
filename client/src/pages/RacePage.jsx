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
    const { user, refetchUser } = useAuth();
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
    const [copiedCode, setCopiedCode] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);
    const [showShareDropdown, setShowShareDropdown] = useState(false);

    // DOM Refs
    const inputRef = useRef(null);
    const joinedRef = useRef(false);

    // 1. Leave room action
    const handleLeaveRoom = useCallback(async () => {
        try {
            sessionStorage.removeItem('typeflow_active_room');
            emit('leave-room', { roomId });
            await api.post(`/rooms/${roomId}/leave`);
        } catch (err) {
            console.warn('REST logout warning:', err.message);
        } finally {
            navigate('/dashboard', { replace: true });
        }
    }, [roomId, emit, navigate]);

    const handleCopyCode = async () => {
        if (!dbRoom?.code) return;
        try {
            await navigator.clipboard.writeText(dbRoom.code);
            setCopiedCode(true);
            setTimeout(() => setCopiedCode(false), 2000);
        } catch (err) {
            console.error('Failed to copy code:', err);
        }
    };

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(`${window.location.origin}/race/${roomId}`);
            setCopiedLink(true);
            setTimeout(() => setCopiedLink(false), 2000);
        } catch (err) {
            console.error('Failed to copy link:', err);
        }
    };

    const handleShareSocial = (platform) => {
        if (!dbRoom?.code) return;
        const msg = `Hey! Let's play a typing race on TypeFLOW. Join using Room Code: ${dbRoom.code}\n🔗 Invite Link: ${window.location.origin}/race/${roomId}`;
        const encodedMsg = encodeURIComponent(msg);

        let shareUrl = '';
        switch (platform) {
            case 'whatsapp':
                shareUrl = `https://api.whatsapp.com/send?text=${encodedMsg}`;
                break;
            case 'telegram':
                shareUrl = `https://t.me/share/url?url=${encodeURIComponent(`${window.location.origin}/race/${roomId}`)}&text=${encodeURIComponent(`Hey! Let's play a typing race on TypeFLOW. Join using Room Code: ${dbRoom.code}`)}`;
                break;
            case 'twitter':
                shareUrl = `https://twitter.com/intent/tweet?text=${encodedMsg}`;
                break;
            case 'email':
                shareUrl = `mailto:?subject=${encodeURIComponent('TypeFLOW Typing Race invite')}&body=${encodedMsg}`;
                break;
            default:
                return;
        }
        window.open(shareUrl, '_blank');
    };

    // 2. Fetch room info from REST API database on mount
    useEffect(() => {
        let active = true;

        const loadRoomData = async () => {
            try {
                const res = await api.get(`/rooms/${roomId}`);
                if (active && res.data?.success && res.data?.data?.room) {
                    let roomData = res.data.data.room;
                    const isAlreadyMember = roomData.members.some(m => m.id === user?.id);
                    if (!isAlreadyMember && roomData.status === 'LOBBY' && user?.id) {
                        try {
                            const joinRes = await api.post('/rooms/join', {
                                code: roomData.code
                            });
                            if (joinRes.data?.success && joinRes.data?.data?.room) {
                                roomData = joinRes.data.data.room;
                            }
                        } catch (joinErr) {
                            console.warn('Auto-join on direct load failed:', joinErr.message);
                        }
                    }
                    setDbRoom(roomData);
                    setRoomStatus(roomData.status);
                    sessionStorage.setItem('typeflow_active_room', JSON.stringify({ roomId, code: roomData.code }));
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
            setRoomStatus((prev) => (prev === 'COMPLETE' ? prev : 'LOBBY'));
            setGraceSecs(null);
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
            setRoomStatus((prev) => (prev === 'COMPLETE' ? prev : 'LOBBY'));
            setCountdownSecs(null);
            setGraceSecs(null);
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
            setMatchResults([]);

            // Reset member states for new race
            setMembers((prev) =>
                prev.map((m) => ({
                    ...m,
                    isReady: false,
                    progress: 0,
                    wpm: 0,
                    accuracy: 100,
                    finished: false,
                    rank: undefined
                }))
            );

            // Re-apply client side casing normalization as a fallback precaution
            let text = payload.paragraphText || '';
            if (text) {
                let lowered = text.toLowerCase();
                text = lowered.replace(/(^\s*|[.!?]\s+)([a-z])/g, (match, separator, letter) => separator + letter.toUpperCase());
                text = text.replace(/\b(i|i'm)\b/g, (match) => match.charAt(0).toUpperCase() + match.slice(1));
            }

            setParagraph(text);
            setParagraphId(payload.paragraphId);
            setCountdownSecs(null);
            setGraceSecs(null);
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
                        ? {
                            ...m,
                            progress: payload.finished ? 100 : payload.progressPercentage,
                            wpm: payload.currentWpm,
                            accuracy: payload.accuracy ?? m.accuracy,
                            finished: Boolean(payload.finished || (payload.progressPercentage >= 100))
                          }
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
            if (refetchUser) refetchUser();
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
            // Unbind socket handlers on unmount WITHOUT leaving room so user can navigate to Leaderboard/Profile and return
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
                const pWords = paragraph.split(' ');
                const tWords = currText.split(' ');
                const typedLen = currText.length;

                let correctCount = 0;
                let mistakes = 0;

                for (let w = 0; w < tWords.length; w++) {
                    if (w >= pWords.length) break;

                    const pWord = pWords[w];
                    const tWord = tWords[w];
                    const isCurrentWord = (w === tWords.length - 1 && typedLen < paragraph.length);

                    if (!isCurrentWord) {
                        if (tWord.toLowerCase() === pWord.toLowerCase()) {
                            correctCount += pWord.length + (w < pWords.length - 1 ? 1 : 0);
                        } else {
                            mistakes += 1;
                            correctCount += Math.max(0, pWord.length - 1) + (w < pWords.length - 1 ? 1 : 0);
                        }
                    } else {
                        const maxChar = Math.min(tWord.length, pWord.length);
                        let wordMistake = 0;
                        for (let c = 0; c < maxChar; c++) {
                            if (tWord[c].toLowerCase() === pWord[c].toLowerCase()) {
                                correctCount++;
                            } else {
                                wordMistake = 1;
                            }
                        }
                        mistakes += wordMistake;
                    }
                }

                if (seconds > 0.5) {
                    const wpm = Math.round((correctCount / 5) / (seconds / 60));
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

        // Word-aligned correct count & mistakes: each mistyped word is only 1 mistake
        const pWords = paragraph.split(' ');
        const tWords = val.split(' ');
        const typedLen = val.length;

        let correctCount = 0;
        let mistakes = 0;

        for (let w = 0; w < tWords.length; w++) {
            if (w >= pWords.length) break;

            const pWord = pWords[w];
            const tWord = tWords[w];
            const isCurrentWord = (w === tWords.length - 1 && typedLen < paragraph.length);

            if (!isCurrentWord) {
                if (tWord.toLowerCase() === pWord.toLowerCase()) {
                    correctCount += pWord.length + (w < pWords.length - 1 ? 1 : 0);
                } else {
                    mistakes += 1;
                    correctCount += Math.max(0, pWord.length - 1) + (w < pWords.length - 1 ? 1 : 0);
                }
            } else {
                const maxChar = Math.min(tWord.length, pWord.length);
                let wordMistake = 0;
                for (let c = 0; c < maxChar; c++) {
                    if (tWord[c].toLowerCase() === pWord[c].toLowerCase()) {
                        correctCount++;
                    } else {
                        wordMistake = 1;
                    }
                }
                mistakes += wordMistake;
            }
        }

        const nextKeys = Math.max(totalKeystrokes, typedLen);
        const acc = nextKeys > 0 ? Math.max(0, Math.round(((nextKeys - mistakes) / nextKeys) * 100)) : 100;
        setLocalAcc(acc);

        // Finish trigger: player has typed all characters of the paragraph
        const isFinished = paragraph && val.length >= paragraph.length;

        if (isFinished) {
            setMembers((prev) =>
                prev.map((m) =>
                    m.userId === user?.id
                        ? { ...m, finished: true, progress: 100 }
                        : m
                )
            );
        }

        // Emit directly — never inside a setState callback
        emit('typing', {
            roomId,
            typedText: val,
            totalKeystrokes: nextKeys,
            isFinished: !!isFinished
        });
    };

    // Counter for character keys — increment on each physical key press
    const handleInputKeyDown = (e) => {
        if (e.key.length === 1) {
            setTotalKeystrokes((prev) => prev + 1);
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

    const isMeHost = dbRoom?.hostId === user?.id;
    const myMember = members.find((m) => m.userId === user?.id);
    const isMeReady = !!myMember?.isReady;
    const currentRacerFinished = Boolean(paragraph && typedText.length >= paragraph.length);

    // Guaranteed finish transition: ONLY show results when ALL racers have completed their text
    const allRacersFinished = members.length >= 2 && members.every((m) => {
        const isCurrentPl = m.userId === user?.id;
        return Boolean(m.finished || (isCurrentPl && currentRacerFinished));
    });

    const isMatchComplete = roomStatus === 'COMPLETE' || (roomStatus === 'RACING' && allRacersFinished);

    const displayResults = (matchResults && matchResults.length > 0)
        ? matchResults
        : members
            .map((m) => {
                const isCurrentPl = m.userId === user?.id;
                const rawWpm = isCurrentPl ? (localWpm || m.wpm || 0) : (m.wpm || 0);
                const rawAcc = isCurrentPl ? (localAcc ?? m.accuracy ?? 100) : (m.accuracy ?? 100);
                const netWpm = Math.round(rawWpm * (rawAcc / 100));
                return {
                    userId: m.userId,
                    username: m.username,
                    wpm: rawWpm,
                    accuracy: rawAcc,
                    netWpm,
                    finished: true
                };
            })
            .sort((a, b) => b.netWpm - a.netWpm)
            .map((r, idx) => ({ ...r, position: idx + 1 }));

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
                        <span className={`badge ${roomStatus === 'RACING' && !isMatchComplete ? 'badge-pink' : 'badge-green'} ${styles.liveBadge}`}>
                            {roomStatus === 'LOBBY' && '🎋 WAITING FOR PLAYERS'}
                            {roomStatus === 'COUNTDOWN' && '⏳ PREPARING...'}
                            {roomStatus === 'RACING' && !isMatchComplete && '🏁 RACING'}
                            {isMatchComplete && '🥇 COMPLETE'}
                        </span>
                        <h1 className={styles.title} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            Room Code: <span className="code-font">{dbRoom?.code}</span>
                            {(roomStatus === 'LOBBY' || roomStatus === 'COUNTDOWN') && (
                                <div className={styles.shareWrapper}>
                                    <button
                                        onClick={() => setShowShareDropdown(!showShareDropdown)}
                                        className={styles.shareTriggerBtn}
                                        title="Invite Competitors"
                                    >
                                        Invite & Share 👥
                                    </button>
                                    {showShareDropdown && (
                                        <div className={styles.shareDropdown}>
                                            <button onClick={handleCopyCode} className={styles.dropdownItem}>
                                                {copiedCode ? 'Copied Code! ✓' : '📋 Copy Code'}
                                            </button>
                                            <button onClick={handleCopyLink} className={styles.dropdownItem}>
                                                {copiedLink ? 'Copied Link! ✓' : '🔗 Copy Invite Link'}
                                            </button>
                                            <button onClick={() => handleShareSocial('whatsapp')} className={`${styles.dropdownItem} ${styles.dropdownWa}`}>
                                                🟢 Share on WhatsApp
                                            </button>
                                            <button onClick={() => handleShareSocial('telegram')} className={`${styles.dropdownItem} ${styles.dropdownTg}`}>
                                                ✈️ Share on Telegram
                                            </button>
                                            <button onClick={() => handleShareSocial('twitter')} className={`${styles.dropdownItem} ${styles.dropdownTw}`}>
                                                🐦 Share on Twitter / X
                                            </button>
                                            <button onClick={() => handleShareSocial('email')} className={styles.dropdownItem}>
                                                ✉️ Share via Email
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
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
                {roomStatus === 'RACING' && !isMatchComplete && (
                    <div className={styles.raceLayout}>
                        {/* Competitor Standings / Progress Bars */}
                        <div className={`card ${styles.progressCard}`}>
                            <h2 className={styles.sectionLabel}>Competitors Progress</h2>
                            <div className={styles.racerContainer}>
                                {members.map((m) => {
                                    const isCurrentPl = m.userId === user?.id;
                                    const isPlFinished = m.finished || (isCurrentPl && currentRacerFinished);
                                    return (
                                        <div key={m.userId} className={styles.racer}>
                                            <div className={styles.racerMeta}>
                                                <span className={styles.racerName}>
                                                    {isCurrentPl ? '🐼 ' : ''}{m.username}
                                                    {isCurrentPl && <span className={`badge badge-green ${styles.youBadge}`}>You</span>}
                                                    {isPlFinished && <span className={styles.finishedMarker}>✓ Finished</span>}
                                                </span>
                                                <span className={styles.racerWpm}>
                                                    {m.wpm > 0 ? `${m.wpm} WPM` : '0 WPM'} • {m.accuracy ?? 100}% ACC
                                                </span>
                                            </div>
                                            <div className={styles.bar}>
                                                <div
                                                    className={styles.barFill}
                                                    style={{ width: `${isPlFinished ? 100 : (m.progress || 0)}%` }}
                                                />
                                                <span className={styles.panda} style={{ left: `${isPlFinished ? 100 : (m.progress || 0)}%` }}>🐼</span>
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
                                placeholder={currentRacerFinished ? "You finished! Waiting for other racers..." : "Type the text as shown..."}
                                rows={3}
                                value={typedText}
                                onChange={handleInputChange}
                                onKeyDown={handleInputKeyDown}
                                disabled={currentRacerFinished}
                            />

                            {currentRacerFinished && (
                                <div style={{
                                    marginTop: '0.75rem',
                                    marginBottom: '0.75rem',
                                    padding: '0.75rem 1rem',
                                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.08))',
                                    border: '1px solid rgba(16, 185, 129, 0.4)',
                                    borderRadius: '10px',
                                    color: '#047857',
                                    fontWeight: 700,
                                    textAlign: 'center',
                                    fontSize: '0.95rem'
                                }}>
                                    ✓ Finished! You have completed the race. Waiting for other racers...
                                </div>
                            )}

                            <div className={styles.typingFooter} style={{ justifyContent: 'flex-end' }}>
                                <div className={styles.liveStats}>
                                    <span>WPM: <strong>{localWpm}</strong></span>
                                    <span>ACC: <strong>{localAcc}%</strong></span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Game End Standings / Leaderboard persistence screen ── */}
                {isMatchComplete && (
                    <div className={styles.completeLayout}>
                        <div className={`card ${styles.resultsCard}`} style={{ position: 'relative' }}>
                            <button
                                onClick={handleLeaveRoom}
                                title="Close result and leave room"
                                aria-label="Close and Leave Room"
                                style={{
                                    position: 'absolute',
                                    top: '1.25rem',
                                    right: '1.25rem',
                                    background: 'var(--bg-hover, #f1f5f9)',
                                    border: '1px solid var(--border, #cbd5e1)',
                                    borderRadius: '50%',
                                    width: '36px',
                                    height: '36px',
                                    fontSize: '1.1rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--text-secondary, #64748b)',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                ✕
                            </button>

                            <div className={styles.resultsHeader}>
                                <span className={styles.trophy}>🏆</span>
                                <h2>Match Completed!</h2>
                                <p>Standings ranked by Net WPM (Speed + Accuracy):</p>
                            </div>

                            <table className={styles.resultsTable}>
                                <thead>
                                    <tr>
                                        <th>Rank</th>
                                        <th>Competitor</th>
                                        <th>Net Speed</th>
                                        <th>Accuracy</th>
                                        <th>XP Added</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayResults.map((r) => {
                                        const isCurrentPl = r.userId === user?.id;
                                        const netWpm = r.netWpm !== undefined ? r.netWpm : Math.round((r.wpm || 0) * ((r.accuracy || 0) / 100));
                                        const baseXP = 20;
                                        const winnerXP = r.position === 1 ? 50 : 0;
                                        const speedXP = Math.floor((r.wpm || 0) / 5);
                                        const accuracyXP = (r.accuracy || 0) >= 100 ? 15 : (r.accuracy || 0) >= 90 ? 10 : 0;
                                        const xpGained = baseXP + winnerXP + speedXP + accuracyXP;

                                        return (
                                            <tr key={r.userId} className={isCurrentPl ? styles.highlightRow : ''}>
                                                <td>
                                                    <strong>#{r.position}</strong>
                                                </td>
                                                <td>
                                                    {r.username} {isCurrentPl && <span className={styles.tableYouTag}>(You)</span>}
                                                    {r.accuracy >= 100 && (
                                                        <span style={{ fontSize: '0.75rem', marginLeft: '6px', color: '#10b981', fontWeight: 600 }}>
                                                            🎯 Perfect Acc
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="code-font">
                                                    <strong>{netWpm} WPM</strong>
                                                    <span style={{ fontSize: '0.78rem', color: '#64748b', display: 'block' }}>
                                                        ({r.wpm} Raw WPM)
                                                    </span>
                                                </td>
                                                <td>
                                                    <span style={{ fontWeight: 600, color: r.accuracy >= 95 ? '#059669' : r.accuracy >= 80 ? '#d97706' : '#dc2626' }}>
                                                        {r.accuracy}%
                                                    </span>
                                                </td>
                                                <td className={styles.xpText}>+{xpGained} XP 🎋</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            <div className={styles.resultsActions} style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                                <button
                                    onClick={() => setRoomStatus('LOBBY')}
                                    className="btn btn-primary"
                                >
                                    🎋 Back to Lobby
                                </button>
                                <button
                                    onClick={handleLeaveRoom}
                                    className="btn btn-ghost"
                                >
                                    Leave Room
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}



