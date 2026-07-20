import fs from 'fs';
import jwt from 'jsonwebtoken';
import http from 'http';
import { io as ioClient } from 'socket.io-client';
import prisma from '../prisma.js';
import app from '../app.js';
import { config } from '../config/index.js';
import * as roomManager from '../socket/roomManager.js';
import { initSocket } from '../socket/index.js';

// ── In-memory stores ──────────────────────────────────────────────────────────
const mockUsers = [
    { id: 'user-h-1', username: 'host_typer', email: 'host@typeflow.com', password: 'fake', xp: 80, level: 1, createdAt: new Date() },
    { id: 'user-g-2', username: 'guest_typer', email: 'guest@typeflow.com', password: 'fake', xp: 40, level: 1, createdAt: new Date() }
];

const mockRooms = [
    { id: 'room-typing-1', code: 'TYPE1', hostId: 'user-h-1', status: 'LOBBY', configDuration: 30, configMode: 'WORDS', memberIds: [] }
];

const mockParagraph = {
    id: 'para-id-abc',
    text: 'hello world',
    wordCount: 2
};

const matchRecords = [];
const resultRecords = [];

// ── Prisma mocks ──────────────────────────────────────────────────────────────
prisma.user.findUnique = async (q) => mockUsers.find(u => u.id === q.where.id) || null;
prisma.paragraph.count = async () => 1;
prisma.paragraph.findFirst = async () => mockParagraph;

prisma.room.findUnique = async (q) => {
    const r = mockRooms.find(rm => rm.id === q.where.id || rm.code === q.where.code);
    if (!r) return null;
    r.members = mockUsers.filter(u => r.memberIds.includes(u.id));
    r.host = mockUsers.find(u => u.id === r.hostId);
    return { ...r };
};

prisma.room.update = async (q) => {
    const r = mockRooms.find(rm => rm.id === q.where.id);
    if (!r) return null;
    if (q.data.members?.connect) r.memberIds.push(q.data.members.connect.id);
    if (q.data.status) r.status = q.data.status;
    r.members = mockUsers.filter(u => r.memberIds.includes(u.id));
    r.host = mockUsers.find(u => r.hostId === u.id);
    return { ...r };
};

prisma.match.create = async (q) => {
    const rec = { id: `match-uuid-${Date.now()}`, ...q.data };
    matchRecords.push(rec);
    return rec;
};

prisma.result.create = async (q) => {
    const rec = { id: `res-uuid-${Date.now()}`, ...q.data };
    // Mock relational joining property for match history endpoints
    rec.match = {
        startedAt: new Date(),
        endedAt: new Date(),
        paragraph: mockParagraph
    };
    resultRecords.push(rec);
    return rec;
};

prisma.result.findMany = async (q) => {
    return resultRecords.filter(r => r.userId === q.where.userId);
};

prisma.result.count = async (q) => {
    return resultRecords.filter(r => r.userId === q.where.userId).length;
};

prisma.user.update = async (q) => {
    const user = mockUsers.find(u => u.id === q.where.id);
    if (user) {
        if (q.data.xp !== undefined) user.xp = q.data.xp;
        if (q.data.level !== undefined) user.level = q.data.level;
    }
    return user;
};

prisma.$transaction = async (cb) => {
    const mockTx = {
        match: prisma.match,
        result: prisma.result,
        room: prisma.room,
        user: prisma.user
    };
    return cb(mockTx);
};

// ── Tokens/Setup ──────────────────────────────────────────────────────────────
const hToken = jwt.sign({ id: 'user-h-1', username: 'host_typer' }, config.jwtSecret, { expiresIn: '1h' });
const gToken = jwt.sign({ id: 'user-g-2', username: 'guest_typer' }, config.jwtSecret, { expiresIn: '1h' });

const PORT = 5004;
const BASE_HTTP = `http://localhost:${PORT}/api`;

async function runTests() {
    const logs = [];
    const log = (msg) => { console.log(msg); logs.push(msg); };

    const httpServer = http.createServer(app);
    initSocket(httpServer);

    // Speed up countdown timer
    const originalSetInterval = global.setInterval;
    global.setInterval = (cb, delay) => originalSetInterval(cb, 10);

    httpServer.listen(PORT, async () => {
        log('[Verification]: Server booted on port ' + PORT);

        let hostClient, guestClient;

        try {
            // ── Step 1: Connect & Join ──────────────────────────────────────────────
            hostClient = ioClient(`http://localhost:${PORT}`, { auth: { token: hToken } });
            guestClient = ioClient(`http://localhost:${PORT}`, { auth: { token: gToken } });

            await new Promise((resolve) => {
                let count = 0;
                hostClient.on('connect', () => { count++; if (count === 2) resolve(); });
                guestClient.on('connect', () => { count++; if (count === 2) resolve(); });
            });

            hostClient.emit('join-room', { roomId: 'room-typing-1' });
            guestClient.emit('join-room', { roomId: 'room-typing-1' });
            await new Promise(r => setTimeout(r, 200));

            // ── Step 2: Start Match via consensus ready ──────────────────────────────
            hostClient.emit('ready', { roomId: 'room-typing-1', isReady: true });
            guestClient.emit('ready', { roomId: 'room-typing-1', isReady: true });

            await new Promise((resolve) => {
                hostClient.on('game-start', () => resolve());
            });

            // ── Step 3: Run authoritative typing simulation ─────────────────────────
            // Host types correctly: WPM = 60, Accuracy = 100, Position = 1 (Winner)
            // Guest types correctly: WPM = 40, Accuracy = 100, Position = 2
            hostClient.emit('typing', { roomId: 'room-typing-1', typedText: 'hello world', totalKeystrokes: 11 });
            guestClient.emit('typing', { roomId: 'room-typing-1', typedText: 'hello world', totalKeystrokes: 11 });

            await new Promise((resolve) => {
                hostClient.on('game-end', () => resolve());
            });

            // ── Step 4: Verify in-memory level update math results ────────────────
            log('\n--- Test 1: Leveling Up and XP calculations ---');
            // Host initial stats: level 1, xp 80.
            // Rewards earned: Base (20) + Win (50) + Speed WPM/5 (0) = 70 XP.
            // Host final XP: 80 + 70 = 150.
            // Advancement check: 150 >= 1 * 100 => Levels up to 2. Remaining: 50 XP.
            const updatedHost = mockUsers.find(u => u.id === 'user-h-1');
            log(`Host ending state: Level ${updatedHost.level} | XP ${updatedHost.xp}`);
            if (updatedHost.level !== 2 || updatedHost.xp !== 50) {
                throw new Error('Host leveling math calculations failed');
            }

            // Guest initial stats: level 1, xp 40.
            // Rewards earned: Base (20) + Speed WPM/5 (0) = 20 XP.
            // Guest final XP: 40 + 20 = 60.
            // Advancement check: 60 < 100 => Stays level 1.
            const updatedGuest = mockUsers.find(u => u.id === 'user-g-2');
            log(`Guest ending state: Level ${updatedGuest.level} | XP ${updatedGuest.xp}`);
            if (updatedGuest.level !== 1 || updatedGuest.xp !== 60) {
                throw new Error('Guest leveling math calculations failed');
            }
            log('XP and leveling outcomes verified.');

            // ── Step 5: Verify REST GET /api/matches (Host History) ────────────────
            log('\n--- Test 2: Paginated Match History Endpoint ---');
            const rHistory = await fetch(`${BASE_HTTP}/matches?page=1&limit=5`, {
                headers: { Authorization: `Bearer ${hToken}` }
            });
            const jHistory = await rHistory.json();
            log(`HTTP status: ${rHistory.status} | matches fetched: ${jHistory.data?.matches?.length}`);
            if (rHistory.status !== 200 || !jHistory.success || jHistory.data.matches.length !== 1) {
                throw new Error('Failed to resolve correct match history data');
            }

            // ── Step 6: Verify REST GET /api/users/:id/stats ───────────────────────
            log('\n--- Test 3: User Statistics Aggregation API ---');
            const rStats = await fetch(`${BASE_HTTP}/users/user-h-1/stats`, {
                headers: { Authorization: `Bearer ${hToken}` }
            });
            const jStats = await rStats.json();
            log(`HTTP status: ${rStats.status} | Total: ${jStats.data?.statistics?.totalRaces} | Wins: ${jStats.data?.statistics?.wins} | PeakWpm: ${jStats.data?.statistics?.peakWpm}`);
            if (rStats.status !== 200 || jStats.data.statistics.wins !== 1 || jStats.data.statistics.totalRaces !== 1) {
                throw new Error('Stats aggregation returns incorrect mappings');
            }

            log('\n=========================================');
            log('VERIFICATION COMPLETED: ALL OUTCOMES PASSED');
            log('=========================================');
        } catch (err) {
            log('\nVerification halted: ' + err.message);
            process.exitCode = 1;
        } finally {
            log('[Verification]: Tearing down sockets and server...');
            if (hostClient) hostClient.close();
            if (guestClient) guestClient.close();
            global.setInterval = originalSetInterval;
            fs.writeFileSync('stats_test_results.log', logs.join('\n'), 'utf-8');
            httpServer.close();
        }
    });
}

runTests();
