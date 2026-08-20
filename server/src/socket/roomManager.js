// In-memory socket room state — separate from the Prisma DB room records.
// Tracks live socket connections, ready states and countdown timers.

// roomId → { hostId, code, members: Map<userId, MemberState>, status, countdownTimer, finishGraceTimer, maxRaceTimer }
const rooms = new Map();

// socketId → roomId  (reverse index)
const socketRoomIndex = new Map();

// ── Room lifecycle ─────────────────────────────────────────────────────────────

export const createSocketRoom = (roomId, hostId, code) => {
    rooms.set(roomId, {
        hostId,
        code,
        members: new Map(),
        status: 'LOBBY',
        countdownTimer: null,
        finishGraceTimer: null,
        maxRaceTimer: null,
        paragraphText: '',
        matchStartedAt: null,
        paragraphId: null
    });
};

export const getRoom = (roomId) => rooms.get(roomId);

export const roomExists = (roomId) => rooms.has(roomId);

export const deleteRoom = (roomId) => {
    const room = rooms.get(roomId);
    if (room) {
        // Clean socket reverse-index entries for all members
        for (const [, member] of room.members) {
            socketRoomIndex.delete(member.socketId);
        }
        if (room.countdownTimer) clearInterval(room.countdownTimer);
        if (room.finishGraceTimer) clearInterval(room.finishGraceTimer);
        if (room.maxRaceTimer) clearInterval(room.maxRaceTimer);
        rooms.delete(roomId);
    }
};

// ── Member management ──────────────────────────────────────────────────────────

export const addMember = (roomId, userId, socketId, username) => {
    const room = rooms.get(roomId);
    if (!room) return false;

    room.members.set(userId, { socketId, username, isReady: false });
    socketRoomIndex.set(socketId, roomId);
    return true;
};

/**
 * @returns {{ isEmpty: boolean, wasHost: boolean, nextHostId: string|null }}
 */
export const removeMember = (roomId, userId) => {
    const room = rooms.get(roomId);
    if (!room) return { isEmpty: true, wasHost: false, nextHostId: null };

    const member = room.members.get(userId);
    if (member) {
        socketRoomIndex.delete(member.socketId);
        room.members.delete(userId);
    }

    const isEmpty = room.members.size === 0;
    const wasHost = room.hostId === userId;

    let nextHostId = null;
    if (!isEmpty && wasHost) {
        // Promote the first remaining member to host
        nextHostId = room.members.keys().next().value;
        room.hostId = nextHostId;
    }

    if (isEmpty) deleteRoom(roomId);

    return { isEmpty, wasHost, nextHostId };
};

// ── Ready state ────────────────────────────────────────────────────────────────

export const setReady = (roomId, userId, isReady) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const member = room.members.get(userId);
    if (member) member.isReady = isReady;
};

export const allReady = (roomId) => {
    const room = rooms.get(roomId);
    if (!room || room.members.size < 1) return false;
    for (const [, m] of room.members) {
        if (!m.isReady) return false;
    }
    return true;
};

// ── Status & countdown ─────────────────────────────────────────────────────────

export const setStatus = (roomId, status) => {
    const room = rooms.get(roomId);
    if (room) room.status = status;
};

export const getStatus = (roomId) => {
    const room = rooms.get(roomId);
    return room ? room.status : null;
};

export const setCountdownTimer = (roomId, timer) => {
    const room = rooms.get(roomId);
    if (room) room.countdownTimer = timer;
};

export const clearCountdown = (roomId) => {
    const room = rooms.get(roomId);
    if (room && room.countdownTimer) {
        clearInterval(room.countdownTimer);
        room.countdownTimer = null;
    }
};

export const setFinishGraceTimer = (roomId, timer) => {
    const room = rooms.get(roomId);
    if (room) room.finishGraceTimer = timer;
};

export const clearFinishGraceTimer = (roomId) => {
    const room = rooms.get(roomId);
    if (room && room.finishGraceTimer) {
        clearInterval(room.finishGraceTimer);
        room.finishGraceTimer = null;
    }
};

export const setMaxRaceTimer = (roomId, timer) => {
    const room = rooms.get(roomId);
    if (room) room.maxRaceTimer = timer;
};

export const clearMaxRaceTimer = (roomId) => {
    const room = rooms.get(roomId);
    if (room && room.maxRaceTimer) {
        clearInterval(room.maxRaceTimer);
        room.maxRaceTimer = null;
    }
};

// ── Reverse lookup ─────────────────────────────────────────────────────────────

export const getRoomBySocketId = (socketId) => {
    const roomId = socketRoomIndex.get(socketId);
    return roomId ? { roomId, room: rooms.get(roomId) } : null;
};

export const getUserIdBySocketId = (socketId) => {
    const roomId = socketRoomIndex.get(socketId);
    if (!roomId) return null;
    const room = rooms.get(roomId);
    if (!room) return null;
    for (const [userId, member] of room.members) {
        if (member.socketId === socketId) return userId;
    }
    return null;
};

// ── Snapshot helpers ───────────────────────────────────────────────────────────

export const getMembersArray = (roomId) => {
    const room = rooms.get(roomId);
    if (!room) return [];
    const result = [];
    for (const [userId, m] of room.members) {
        result.push({
            userId,
            username: m.username,
            isReady: m.isReady,
            progress: m.progress || 0,
            wpm: m.wpm || 0,
            accuracy: m.accuracy || 100,
            finished: m.finished || false
        });
    }
    return result;
};

// ── Race state management ──────────────────────────────────────────────────────

export const startRace = (roomId, paragraphId, paragraphText) => {
    const room = rooms.get(roomId);
    if (!room) return;

    clearFinishGraceTimer(roomId);
    clearMaxRaceTimer(roomId);

    room.status = 'RACING';
    room.paragraphId = paragraphId;
    room.paragraphText = paragraphText;
    room.matchStartedAt = Date.now();

    for (const [, member] of room.members) {
        member.progress = 0;
        member.wpm = 0;
        member.accuracy = 100;
        member.finished = false;
        member.finishedAt = null;
        member.totalKeystrokes = 0;
        member.wpmHistory = [0]; // Initialize with 0 WPM at standard 0th second
    }
};

export const updatePlayerProgress = (roomId, userId, typedText, totalKeystrokes, isFinishedExplicit = false) => {
    const room = rooms.get(roomId);
    if (!room || room.status !== 'RACING') return null;

    const member = room.members.get(userId);
    if (!member || member.finished) return null;

    const paragraph = room.paragraphText;
    const paragraphLen = paragraph.length;
    const typedLen = typedText.length;

    // Word-aligned matching: each mistyped word counts as only 1 mistake
    const pWords = paragraph.split(' ').filter(Boolean);
    const tWords = typedText.split(' ').filter(Boolean);

    let correctLength = 0;
    let mistakes = 0;

    for (let w = 0; w < tWords.length; w++) {
        if (w >= pWords.length) break;

        const pWord = pWords[w];
        const tWord = tWords[w];
        const isCurrentWord = (w === tWords.length - 1 && typedLen < paragraphLen && !isFinishedExplicit);

        if (!isCurrentWord) {
            // Completed word
            if (tWord.toLowerCase() === pWord.toLowerCase()) {
                correctLength += pWord.length + (w < pWords.length - 1 ? 1 : 0);
            } else {
                // Word has typo(s) — ONLY ONE MISTAKE is considered for this word!
                mistakes += 1;
                correctLength += Math.max(0, pWord.length - 1) + (w < pWords.length - 1 ? 1 : 0);
            }
        } else {
            // Word currently in progress
            const maxChar = Math.min(tWord.length, pWord.length);
            let wordMistake = 0;
            for (let c = 0; c < maxChar; c++) {
                if (tWord[c].toLowerCase() === pWord[c].toLowerCase()) {
                    correctLength++;
                } else {
                    wordMistake = 1;
                }
            }
            mistakes += wordMistake;
        }
    }

    // Prevent impossible keystroke entries
    const keystrokes = Math.max(totalKeystrokes || 0, typedLen);
    const elapsed = (Date.now() - room.matchStartedAt) / 1000;
    const wpm = elapsed > 0.5 ? Math.round((correctLength / 5) / (elapsed / 60)) : 0;
    const accuracy = keystrokes > 0 ? Math.max(0, Math.round(((keystrokes - mistakes) / keystrokes) * 100)) : 100;
    const progress = Math.min(100, Math.round((typedLen / paragraphLen) * 100));

    // Save to active socket user cache record
    member.progress = progress;
    member.wpm = wpm;
    member.accuracy = accuracy;
    member.totalKeystrokes = keystrokes;
    member.mistakes = mistakes;

    console.log(`[Socket][DEBUG] Player ${member.username} stats: typedLen=${typedLen}/${paragraphLen}, words=${tWords.length}/${pWords.length}, mistakes=${mistakes}, progress=${progress}%, WPM=${wpm}, isFinished=${isFinishedExplicit}`);

    const secondIndex = Math.max(1, Math.floor(elapsed));
    if (!member.wpmHistory) member.wpmHistory = [0];
    while (member.wpmHistory.length <= secondIndex) {
        member.wpmHistory.push(wpm);
    }

    // Finish condition: Player has typed all characters of the paragraph or explicit finish
    const isCompleted = isFinishedExplicit || typedLen >= paragraphLen;

    if (isCompleted) {
        member.finished = true;
        member.finishedAt = Date.now();
        member.progress = 100;
        member.wpmHistory[secondIndex] = wpm; // ensure final WPM is correct
    }

    return {
        userId,
        username: member.username,
        progress: member.progress,
        wpm,
        accuracy,
        finished: member.finished,
        elapsedTime: elapsed
    };
};

export const hasAnyFinished = (roomId) => {
    const room = rooms.get(roomId);
    if (!room) return false;
    for (const [, m] of room.members) {
        if (m.finished) return true;
    }
    return false;
};

export const allFinished = (roomId) => {
    const room = rooms.get(roomId);
    if (!room || room.members.size < 1) return false;
    for (const [, m] of room.members) {
        if (!m.finished) return false;
    }
    return true;
};

export const forceFinishAll = (roomId) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const now = Date.now();
    for (const [, m] of room.members) {
        if (!m.finished) {
            m.finished = true;
            m.finishedAt = now;
        }
    }
};

export const getRaceResults = (roomId) => {
    const room = rooms.get(roomId);
    if (!room) return [];

    const results = [];
    for (const [userId, m] of room.members) {
        results.push({
            userId,
            username: m.username,
            wpm: m.wpm || 0,
            accuracy: m.accuracy || 0,
            progress: m.progress || 0,
            finishedAt: m.finishedAt || Infinity,
            finished: m.finished || false,
            wpmHistory: m.wpmHistory || []
        });
    }

    results.sort((a, b) => {
        // Priority 1: Finished racers above non-finished racers
        if (a.finished !== b.finished) return a.finished ? -1 : 1;

        // Priority 2: Net WPM (WPM * (Accuracy %)) combines speed & accuracy for ultimate skill rank
        const netWpmA = (a.wpm || 0) * ((a.accuracy || 0) / 100);
        const netWpmB = (b.wpm || 0) * ((b.accuracy || 0) / 100);

        if (Math.abs(netWpmB - netWpmA) > 0.5) {
            return netWpmB - netWpmA; // Higher Net WPM wins
        }

        // Priority 3: Tie-breaker - Accuracy %
        if (a.accuracy !== b.accuracy) {
            return b.accuracy - a.accuracy; // Higher accuracy wins
        }

        // Priority 4: Tie-breaker - Finish time / Progress
        if (a.finished) {
            return a.finishedAt - b.finishedAt;
        }

        return b.progress - a.progress;
    });

    return results.map((res, index) => ({
        ...res,
        position: index + 1
    }));
};

