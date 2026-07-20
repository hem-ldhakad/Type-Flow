import prisma from '../prisma.js';
import app from '../app.js';
import { config } from '../config/index.js';

// In-memory array simulating user records
const mockUsers = [];

// Mocking Prisma DB functions to enable database-less assertions
prisma.user.findFirst = async (query) => {
    const or = query.where?.OR;
    if (!or) return null;
    const email = or[0]?.email;
    const username = or[1]?.username;
    return mockUsers.find(u => u.email === email || u.username === username) || null;
};

prisma.user.findUnique = async (query) => {
    const { email, id } = query.where;
    let user = null;
    if (email) user = mockUsers.find(u => u.email === email) || null;
    if (id) user = mockUsers.find(u => u.id === id) || null;

    if (user && query.select) {
        const selected = {};
        for (const key of Object.keys(query.select)) {
            if (query.select[key]) {
                selected[key] = user[key];
            }
        }
        return selected;
    }
    return user;
};

prisma.user.create = async (query) => {
    const { username, email, password } = query.data;
    const newUser = {
        id: `mock-id-${Date.now()}`,
        username,
        email,
        password,
        xp: 0,
        level: 1,
        createdAt: new Date()
    };
    mockUsers.push(newUser);
    return newUser;
};

import fs from 'fs';

const PORT = 5001;

async function runTests() {
    const logBuffer = [];
    const log = (...args) => {
        const message = args.join(' ');
        console.log(message);
        logBuffer.push(message);
    };

    const server = app.listen(PORT, async () => {
        log(`[Verification]: Test server running on port ${PORT}`);

        try {
            let testToken = '';

            // Test 1: Successful Registration
            log('\n--- Test 1: Registering User ---');
            const regRes = await fetch(`http://localhost:${PORT}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: 'test_coder',
                    email: 'coder@typeflow.com',
                    password: 'securePassword123'
                })
            });
            const regJson = await regRes.json();
            log('Status: ' + regRes.status);
            log('Body: ' + JSON.stringify(regJson, null, 2));
            if (regRes.status !== 201 || !regJson.success) throw new Error('Test 1 Failed');
            testToken = regJson.data.token;

            // Test 2: Registration Validation Error (Duplicate Username/Email)
            log('\n--- Test 2: Duplicate Registration Error ---');
            const regDupRes = await fetch(`http://localhost:${PORT}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: 'test_coder',
                    email: 'coder@typeflow.com',
                    password: 'securePassword123'
                })
            });
            const regDupJson = await regDupRes.json();
            log('Status: ' + regDupRes.status);
            log('Body: ' + JSON.stringify(regDupJson, null, 2));
            if (regDupRes.status !== 400 || regDupJson.success) throw new Error('Test 2 Failed');

            // Test 3: Successful Login
            log('\n--- Test 3: Standard User Login ---');
            const loginRes = await fetch(`http://localhost:${PORT}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: 'coder@typeflow.com',
                    password: 'securePassword123'
                })
            });
            const loginJson = await loginRes.json();
            log('Status: ' + loginRes.status);
            log('Body: ' + JSON.stringify(loginJson, null, 2));
            if (loginRes.status !== 200 || !loginJson.success) throw new Error('Test 3 Failed');

            // Test 4: Failed Login (Wrong Password)
            log('\n--- Test 4: Failed Login Incorrect Credentials ---');
            const loginErrRes = await fetch(`http://localhost:${PORT}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: 'coder@typeflow.com',
                    password: 'wrongPassword'
                })
            });
            const loginErrJson = await loginErrRes.json();
            log('Status: ' + loginErrRes.status);
            log('Body: ' + JSON.stringify(loginErrJson, null, 2));
            if (loginErrRes.status !== 401 || loginErrJson.success) throw new Error('Test 4 Failed');

            // Test 5: Verify Auth Middleware (GET /me with Bearer token)
            log('\n--- Test 5: Profile Request with Valid Token ---');
            const meRes = await fetch(`http://localhost:${PORT}/api/auth/me`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${testToken}`
                }
            });
            const meJson = await meRes.json();
            log('Status: ' + meRes.status);
            log('Body: ' + JSON.stringify(meJson, null, 2));
            if (meRes.status !== 200 || !meJson.success) throw new Error('Test 5 Failed');

            // Test 6: Verify Auth Middleware Deny (GET /me with Invalid Token)
            log('\n--- Test 6: Profile Request with Faked Token ---');
            const meErrRes = await fetch(`http://localhost:${PORT}/api/auth/me`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer fake_jwt_token_stub`
                }
            });
            const meErrJson = await meErrRes.json();
            log('Status: ' + meErrRes.status);
            log('Body: ' + JSON.stringify(meErrJson, null, 2));
            if (meErrRes.status !== 401 || meErrJson.success) throw new Error('Test 6 Failed');

            log('\n=========================================');
            log('VERIFICATION COMPLETED: ALL AUTH TESTS PASSED');
            log('=========================================');
        } catch (testError) {
            log('\nVerification halted. Assertion Failure: ' + testError.message);
            process.exitCode = 1;
        } finally {
            log('[Verification]: Shutting down test server...');
            try {
                fs.writeFileSync('auth_test_results.log', logBuffer.join('\n'), 'utf-8');
            } catch (err) {
                console.error('Failed to write log file:', err);
            }
            server.close();
        }
    });
}

runTests();
