import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import prisma from '../prisma.js';
import * as roomManager from './roomManager.js';
import joinRoomHandler from './handlers/joinRoom.js';
import leaveRoomHandler from './handlers/leaveRoom.js';
import readyHandler from './handlers/ready.js';
import typingHandler from './handlers/typing.js';
import disconnectHandler from './handlers/disconnect.js';

export const initSocket = (httpServer) => {
    const io = new Server(httpServer, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
            allowedHeaders: ['Authorization']
        }
    });

    // ── JWT handshake middleware ─────────────────────────────────────────────────
    // Clients must connect with: io({ auth: { token: '<jwt>' } })
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;

        if (!token) {
            return next(new Error('Authentication error: token not provided.'));
        }

        try {
            const decoded = jwt.verify(token, config.jwtSecret);
            // Decorate the socket object so all handlers can access user identity
            socket.user = { id: decoded.id, username: decoded.username };
            next();
        } catch {
            next(new Error('Authentication error: invalid or expired token.'));
        }
    });

    // ── Connection handler ───────────────────────────────────────────────────────
    io.on('connection', (socket) => {
        console.log(`[Socket]: ${socket.user.username} connected (${socket.id})`);

        // Room management events
        socket.on('join-room', (payload) => joinRoomHandler(io, socket, payload));
        socket.on('leave-room', (payload) => leaveRoomHandler(io, socket, payload));

        // Ready / countdown events
        socket.on('ready', (payload) => readyHandler(io, socket, payload));

        // Solo / Multiplayer mode toggle
        socket.on('toggle-solo-mode', (payload) => {
            try {
                const { roomId, isSolo } = payload;
                const room = roomManager.getRoom(roomId);
                if (!room) return;
                // Only host can modify
                if (room.hostId !== socket.user.id) {
                    return socket.emit('error', { message: 'Only the room host can change game mode.' });
                }
                room.isSolo = !!isSolo;
                io.to(roomId).emit('room-mode-updated', { isSolo: room.isSolo });
                console.log(`[Socket]: Room ${roomId} switched isSolo to ${room.isSolo}`);
            } catch (err) {
                console.error('[Socket][toggle-solo-mode] error:', err);
            }
        });

        // Update Room Config (e.g. word count)
        socket.on('update-room-config', async (payload) => {
            try {
                const { roomId, configWordCount } = payload;
                const room = roomManager.getRoom(roomId);
                if (!room) return;
                // Only host can modify
                if (room.hostId !== socket.user.id) {
                    return socket.emit('error', { message: 'Only the room host can update room configuration.' });
                }
                const VALID_WORD_COUNTS = [10, 25, 50, 100];
                if (!VALID_WORD_COUNTS.includes(configWordCount)) {
                    return socket.emit('error', { message: 'Invalid word count selected. Choose 10, 25, 50, or 100.' });
                }

                // Update database
                await prisma.room.update({
                    where: { id: roomId },
                    data: { configWordCount }
                });

                // Broadcast change to all room members
                io.to(roomId).emit('room-config-updated', { configWordCount });
                console.log(`[Socket]: Room ${roomId} configWordCount updated to ${configWordCount}`);
            } catch (err) {
                console.error('[Socket][update-room-config] error:', err);
            }
        });

        // Typing activity events
        socket.on('typing', (payload) => typingHandler(io, socket, payload));

        // Built-in disconnect
        socket.on('disconnect', () => disconnectHandler(io, socket));
    });

    console.log('[Socket]: Socket.IO server initialized.');
    return io;
};
