// In-memory socket room state — separate from the Prisma DB room records.
// Tracks live socket connections, ready states and countdown timers.

// roomId → { hostId, code, members: Map<userId, MemberState>, status, countdownTimer }
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

export const updatePlayerProgress = (roomId, userId, typedText, totalKeystrokes) => {
    const room = rooms.get(roomId);
    if (!room || room.status !== 'RACING') return null;

    const member = room.members.get(userId);
    if (!member || member.finished) return null;

    const paragraph = room.paragraphText;
    const paragraphLen = paragraph.length;

    // Count total correct characters matching paragraph at that index
    let correctLength = 0;
    const typedLen = typedText.length;
    const maxMatch = Math.min(typedLen, paragraphLen);

    for (let i = 0; i < maxMatch; i++) {
        if (typedText[i] === paragraph[i]) {
            correctLength++;
        }
    }

    // Prevent impossible keystroke entries (total must be >= correct length)
    const keystrokes = Math.max(totalKeystrokes || 0, correctLength);

    // Calculate elapsed duration
    const elapsed = (Date.now() - room.matchStartedAt) / 1000;

    // WPM definition: 5 character blocks divided by minutes
    const wpm = elapsed > 0.5 ? Math.round((correctLength / 5) / (elapsed / 60)) : 0;

    // Accuracy calculation %
    const accuracy = keystrokes > 0 ? Math.round((correctLength / keystrokes) * 100) : 100;

    // Progress percentage
    const progress = Math.round((typedLen / paragraphLen) * 100);

    // Save to active socket user cache record
    member.progress = progress;
    member.wpm = wpm;
    member.accuracy = accuracy;
    member.totalKeystrokes = keystrokes;

    // Track WPM history second by second
    const secondIndex = Math.max(1, Math.floor(elapsed));
    if (!member.wpmHistory) {
        member.wpmHistory = [0];
    }
    while (member.wpmHistory.length <= secondIndex) {
        member.wpmHistory.push(wpm);
    }

    if (typedLen === paragraphLen) {
        member.finished = true;
        member.finishedAt = Date.now();
        member.wpmHistory[secondIndex] = wpm; // ensure final WPM is correct
    }

    return {
        userId,
        username: member.username,
        progress,
        wpm,
        accuracy,
        finished: member.finished,
        elapsedTime: elapsed
    };
};

export const allFinished = (roomId) => {
    const room = rooms.get(roomId);
    if (!room) return false;
    for (const [, m] of room.members) {
        if (!m.finished) return false;
    }
    return true;
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
        if (a.finished !== b.finished) return a.finished ? -1 : 1;
        if (a.finished) return a.finishedAt - b.finishedAt;
        if (a.progress !== b.progress) return b.progress - a.progress;
        return b.wpm - a.wpm;
    });

    return results.map((res, index) => ({
        ...res,
        position: index + 1
    }));
};
