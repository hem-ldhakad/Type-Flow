import * as roomManager from '../roomManager.js';
import { startCountdown, cancelCountdown } from './countdown.js';

const ready = (io, socket, payload) => {
    try {
        const { roomId, isReady } = payload;
        const { id: userId } = socket.user;

        const room = roomManager.getRoom(roomId);
        if (!room) {
            return socket.emit('error', { message: 'Room not found in active session.' });
        }

        // Only allow ready toggling while in LOBBY or COUNTDOWN state
        if (room.status === 'RACING') {
            return socket.emit('error', { message: 'Game is already in progress.' });
        }

        roomManager.setReady(roomId, userId, isReady);

        // Broadcast the updated ready status to all room members
        io.to(roomId).emit('player-ready-status', { userId, isReady });

        if (isReady && roomManager.allReady(roomId)) {
            // All players are ready — start the countdown
            startCountdown(io, roomId);
        } else if (!isReady && room.status === 'COUNTDOWN') {
            // A player un-readied during countdown — abort it
            cancelCountdown(io, roomId);
            io.to(roomId).emit('countdown-cancelled', { reason: `${socket.user.username} is no longer ready.` });
        }
    } catch (err) {
        console.error('[Socket][ready] error:', err);
        socket.emit('error', { message: 'Failed to update ready state.' });
    }
};

export default ready;
