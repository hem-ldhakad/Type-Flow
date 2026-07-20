import fs from 'fs';
import prisma from '../prisma.js';
import app from '../app.js';

// ── In-memory stores ──────────────────────────────────────────────────────────
const mockUsers = [
    { id: 'user-host-1', username: 'host_player', email: 'host@typeflow.com', password: '$2b$10$fakehashedpassword', xp: 100, level: 2, createdAt: new Date() },
    { id: 'user-guest-2', username: 'guest_player', email: 'guest@typeflow.com', password: '$2b$10$fakehashedpassword', xp: 50, level: 1, createdAt: new Date() }
];
const mockRooms = [];

// ── Prisma mock stubs ─────────────────────────────────────────────────────────
prisma.user.findUnique = async (q) => {
    const { id, email } = q.where;
    const user = id
        ? mockUsers.find(u => u.id === id)
        : mockUsers.find(u => u.email === email);
    if (!user) return null;
    if (q.select) {
        const out = {};
        for (const k of Object.keys(q.select)) { if (q.select[k]) out[k] = user[k]; }
        return out;
    }
    return user;
};

prisma.room.findUnique = async (q) => {
    const { id, code } = q.where;
    const room = id ? mockRooms.find(r => r.id === id) : mockRooms.find(r => r.code === code);
    if (!room) return null;
    if (q.include?.members) room.members = mockUsers.filter(u => room.memberIds.includes(u.id));
    if (q.include?.host) room.host = mockUsers.find(u => u.id === room.hostId);
    return room ? { ...room } : null;
};

prisma.room.create = async (q) => {
    const { code, hostId, status, configDuration, configMode, members } = q.data;
    const connected = members?.connect ? [members.connect.id] : [];
    const room = {
        id: `room-${Date.now()}`,
        code, hostId, status, configDuration, configMode,
        memberIds: connected,
        createdAt: new Date()
    };
    mockRooms.push(room);
    room.members = mockUsers.filter(u => room.memberIds.includes(u.id));
    room.host = mockUsers.find(u => u.id === room.hostId);
    return room;
};

prisma.room.update = async (q) => {
    const room = mockRooms.find(r => r.id === q.where.id);
    if (!room) return null;
    if (q.data.members?.connect) room.memberIds.push(q.data.members.connect.id);
    if (q.data.members?.disconnect) room.memberIds = room.memberIds.filter(id => id !== q.data.members.disconnect.id);
    if (q.data.hostId) room.hostId = q.data.hostId;
    room.members = mockUsers.filter(u => room.memberIds.includes(u.id));
    room.host = mockUsers.find(u => u.id === room.hostId);
    return room;
};

prisma.room.delete = async (q) => {
    const idx = mockRooms.findIndex(r => r.id === q.where.id);
    if (idx !== -1) mockRooms.splice(idx, 1);
};

// ── Helpers ───────────────────────────────────────────────────────────────────
// Import jwt+config to mint real tokens for mock users
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
const mintToken = (user) => jwt.sign({ id: user.id, username: user.username }, config.jwtSecret, { expiresIn: '1h' });
const hostToken = mintToken(mockUsers[0]);
const guestToken = mintToken(mockUsers[1]);

const PORT = 5002;
const BASE = `http://localhost:${PORT}/api/rooms`;

// ── Test runner ───────────────────────────────────────────────────────────────
async function runTests() {
    const logs = [];
    const log = (msg) => { console.log(msg); logs.push(msg); };

    const server = app.listen(PORT, async () => {
        log('[Verification]: Room API test server on port ' + PORT);
        let roomId, roomCode;

        try {
            // ── Test 1: Create Room (host) ──────────────────────────────────────────
            log('\n--- Test 1: Create Room ---');
            const r1 = await fetch(BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hostToken}` },
                body: JSON.stringify({ configDuration: 60, configMode: 'TIME' })
            });
            const j1 = await r1.json();
            log('Status: ' + r1.status + ' | ' + JSON.stringify(j1.data?.room?.code));
            if (r1.status !== 201 || !j1.success) throw new Error('Test 1 Failed');
            roomId = j1.data.room.id;
            roomCode = j1.data.room.code;

            // ── Test 2: Invalid configDuration ─────────────────────────────────────
            log('\n--- Test 2: Invalid configDuration ---');
            const r2 = await fetch(BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hostToken}` },
                body: JSON.stringify({ configDuration: 999 })
            });
            const j2 = await r2.json();
            log('Status: ' + r2.status + ' | ' + j2.message);
            if (r2.status !== 400) throw new Error('Test 2 Failed');

            // ── Test 3: Get Room ────────────────────────────────────────────────────
            log('\n--- Test 3: Get Room ---');
            const r3 = await fetch(`${BASE}/${roomId}`, {
                headers: { Authorization: `Bearer ${hostToken}` }
            });
            const j3 = await r3.json();
            log('Status: ' + r3.status + ' | members: ' + JSON.stringify(j3.data?.room?.members?.map(m => m.username)));
            if (r3.status !== 200 || !j3.success) throw new Error('Test 3 Failed');

            // ── Test 4: Guest joins room ────────────────────────────────────────────
            log('\n--- Test 4: Join Room ---');
            const r4 = await fetch(`${BASE}/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${guestToken}` },
                body: JSON.stringify({ code: roomCode })
            });
            const j4 = await r4.json();
            log('Status: ' + r4.status + ' | members: ' + JSON.stringify(j4.data?.room?.members?.map(m => m.username)));
            if (r4.status !== 200 || !j4.success) throw new Error('Test 4 Failed');

            // ── Test 5: Join non-existent room ─────────────────────────────────────
            log('\n--- Test 5: Join Invalid Code ---');
            const r5 = await fetch(`${BASE}/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${guestToken}` },
                body: JSON.stringify({ code: 'XXXXXX' })
            });
            const j5 = await r5.json();
            log('Status: ' + r5.status + ' | ' + j5.message);
            if (r5.status !== 404) throw new Error('Test 5 Failed');

            // ── Test 6: Guest leaves room ───────────────────────────────────────────
            log('\n--- Test 6: Leave Room (guest) ---');
            const r6 = await fetch(`${BASE}/${roomId}/leave`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${guestToken}` }
            });
            const j6 = await r6.json();
            log('Status: ' + r6.status + ' | disbanded: ' + j6.data?.disbanded);
            if (r6.status !== 200 || !j6.success) throw new Error('Test 6 Failed');

            // ── Test 7: Host leaves (room disbands) ────────────────────────────────
            log('\n--- Test 7: Leave Room (host, disband) ---');
            const r7 = await fetch(`${BASE}/${roomId}/leave`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${hostToken}` }
            });
            const j7 = await r7.json();
            log('Status: ' + r7.status + ' | disbanded: ' + j7.data?.disbanded);
            if (r7.status !== 200 || !j7.data?.disbanded) throw new Error('Test 7 Failed');

            log('\n=========================================');
            log('VERIFICATION COMPLETED: ALL ROOM TESTS PASSED');
            log('=========================================');
        } catch (err) {
            log('\nVerification halted: ' + err.message);
            process.exitCode = 1;
        } finally {
            log('[Verification]: Shutting down...');
            fs.writeFileSync('room_test_results.log', logs.join('\n'), 'utf-8');
            server.close();
        }
    });
}

runTests();
