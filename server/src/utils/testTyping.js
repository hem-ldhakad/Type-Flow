import fs from 'fs';
import http from 'http';
import jwt from 'jsonwebtoken';
import { initSocket } from '../socket/index.js';
import { Server } from 'socket.io';
import { io as ioClient } from 'socket.io-client';
import prisma from '../prisma.js';
import app from '../app.js';
import { config } from '../config/index.js';
import * as roomManager from '../socket/roomManager.js';

// ── In-memory stores ──────────────────────────────────────────────────────────
const mockUsers = [
    { id: 'user-h-1', username: 'host_typer', email: 'host@typeflow.com', password: 'fake', xp: 0, level: 1, createdAt: new Date() },
    { id: 'user-g-2', username: 'guest_typer', email: 'guest@typeflow.com', password: 'fake', xp: 0, level: 1, createdAt: new Date() }
];

const mockRooms = [
    { id: 'room-typing-1', code: 'TYPE1', hostId: 'user-h-1', status: 'LOBBY', configDuration: 30, configMode: 'WORDS', memberIds: [] }
];

const mockParagraph = {
    id: 'para-id-abc',
    text: 'hello world',
    wordCount: 2
};

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

// Mock Match and Result creations
const matchRecords = [];
const resultRecords = [];

prisma.match.create = async (q) => {
    const rec = { id: `match-uuid-${Date.now()}`, ...q.data };
    matchRecords.push(rec);
    return rec;
};

prisma.result.create = async (q) => {
    const rec = { id: `res-uuid-${Date.now()}`, ...q.data };
    resultRecords.push(rec);
    return rec;
};

// Wrap transaction calls
prisma.$transaction = async (cb) => {
    const mockTx = {
        match: prisma.match,
        result: prisma.result,
        room: prisma.room
    };
    return cb(mockTx);
};

// ── Tokens ────────────────────────────────────────────────────────────────────
const hToken = jwt.sign({ id: 'user-h-1', username: 'host_typer' }, config.jwtSecret, { expiresIn: '1h' });
const gToken = jwt.sign({ id: 'user-g-2', username: 'guest_typer' }, config.jwtSecret, { expiresIn: '1h' });

const PORT = 5003;

async function runTests() {
    const logs = [];
    const log = (msg) => { console.log(msg); logs.push(msg); };

    // Bind server
    const httpServer = http.createServer(app);
    initSocket(httpServer);

    // Speed up countdown timer for fast test suite resolution
    // Overrides setInterval globally during test starting phase
    const originalSetInterval = global.setInterval;
    global.setInterval = (cb, delay) => {
        // Force faster ticks (10ms instead of 1000ms) for our countdown ticks
        return originalSetInterval(cb, 10);
    };

    httpServer.listen(PORT, async () => {
        log('[Verification]: Server booted on port ' + PORT);

        let hostClient, guestClient;

        try {
            // ── Step 1: Connect sockets ─────────────────────────────────────────────
            log('\n--- Test 1: Sockets Connection with JWT Handshake ---');

            hostClient = ioClient(`http://localhost:${PORT}`, {
                auth: { token: hToken }
            });
            guestClient = ioClient(`http://localhost:${PORT}`, {
                auth: { token: gToken }
            });

            await new Promise((resolve) => {
                let connectedCount = 0;
                const check = () => {
                    connectedCount++;
                    if (connectedCount === 2) resolve();
                };
                hostClient.on('connect', check);
                guestClient.on('connect', check);
            });
            log('Sockets connected successfully.');

            // ── Step 2: Join target room ────────────────────────────────────────────
            log('\n--- Test 2: Room join events ---');
            hostClient.emit('join-room', { roomId: 'room-typing-1' });

            await new Promise((resolve) => {
                hostClient.on('room-joined', (data) => {
                    log('Host joined room: ' + data.code);
                    resolve();
                });
            });

            guestClient.emit('join-room', { roomId: 'room-typing-1' });
            await new Promise((resolve) => {
                guestClient.on('room-joined', (data) => {
                    log('Guest joined room: ' + data.code);
                    resolve();
                });
            });

            // ── Step 3: Trigger Ready & Countdown ──────────────────────────────────
            log('\n--- Test 3: Ready states and auto-countdown start ---');

            hostClient.emit('ready', { roomId: 'room-typing-1', isReady: true });
            guestClient.emit('ready', { roomId: 'room-typing-1', isReady: true });

            // Wait for game-start event (triggered by countdown tick completing)
            const paragraphData = await new Promise((resolve) => {
                hostClient.on('game-start', (data) => {
                    log('Match started! Paragraph received: "' + data.paragraphText + '"');
                    resolve(data);
                });
            });

            // ── Step 4: Live typing and authoritative metric checks ────────────────
            log('\n--- Test 4: typing validation progress and accuracy tests ---');

            // Setup listeners for progress updates
            const progressTracker = [];
            hostClient.on('progress-update', (data) => {
                progressTracker.push(data);
            });

            // Host types the correct prefix "hell"
            log('Host typing correct prefix "hell"...');
            hostClient.emit('typing', {
                roomId: 'room-typing-1',
                typedText: 'hell',
                totalKeystrokes: 4
            });

            await new Promise(r => setTimeout(r, 100)); // wait for socket delivery

            let hostProg = progressTracker[progressTracker.length - 1];
            log(`Host progress: ${hostProg?.progressPercentage}% | WPM: ${hostProg?.currentWpm}`);
            // "hell" contains 4 characters. Paragraph is "hello world" (11 characters).
            // Progress = Math.round((4 / 11) * 100) = 36%
            if (hostProg?.progressPercentage !== 36) throw new Error('Progress math mismatch');

            // Guest type typo "hellx" (should halt matching at index 4)
            log('\nGuest typing typo "hellx" (should stop matching at "hell")...');
            guestClient.emit('typing', {
                roomId: 'room-typing-1',
                typedText: 'hellx',
                totalKeystrokes: 5
            });

            await new Promise(r => setTimeout(r, 100));

            // Guest typed 5 keys but only 4 matched
            // Correct: 4, TotalKey: 5 => Accuracy: Math.round(4 / 5 * 100) = 80%.
            // Let's assert database-less accuracy checks.
            const room = roomManager.getRoom('room-typing-1');
            const guestDetails = room.members.get('user-g-2');
            log(`Guest accuracy tracked: ${guestDetails.accuracy}% | progress: ${guestDetails.progress}%`);
            if (guestDetails.accuracy !== 80) throw new Error('Accuracy math mismatch on typos');

            // ── Step 5: Complete match and check DB persists ───────────────────────
            log('\n--- Test 5: Completion detection and DB transaction saving ---');

            const finishTrigger = new Promise((resolve) => {
                hostClient.on('player-finished', (data) => {
                    log(`Player finished broadcast: ${data.username} placed #${data.rank} with ${data.wpm} WPM`);
                    resolve();
                });
            });

            // Host types correctly to the end
            hostClient.emit('typing', {
                roomId: 'room-typing-1',
                typedText: 'hello world',
                totalKeystrokes: 11
            });

            await finishTrigger;

            // Guest also finishes typing correctly
            guestClient.emit('typing', {
                roomId: 'room-typing-1',
                typedText: 'hello world',
                totalKeystrokes: 12
            });

            const gameEndData = await new Promise((resolve) => {
                hostClient.on('game-end', (data) => {
                    log('\nMatch Ended: Game standings received.');
                    log(JSON.stringify(data.results, null, 2));
                    resolve(data);
                });
            });

            log(`Total matches saved: ${matchRecords.length} | Results entries: ${resultRecords.length}`);
            if (matchRecords.length !== 1 || resultRecords.length !== 2) {
                throw new Error('Database transaction records save count mismatch');
            }

            log('\n=========================================');
            log('VERIFICATION COMPLETED: ALL TYPING TESTS PASSED');
            log('=========================================');
        } catch (err) {
            log('\nVerification halted: ' + err.message);
            process.exitCode = 1;
        } finally {
            log('[Verification]: Cleaning up connections...');
            if (hostClient) hostClient.close();
            if (guestClient) guestClient.close();
            global.setInterval = originalSetInterval; // restore
            fs.writeFileSync('typing_test_results.log', logs.join('\n'), 'utf-8');
            httpServer.close();
        }
    });
}

runTests();
