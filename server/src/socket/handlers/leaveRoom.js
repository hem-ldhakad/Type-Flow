import * as roomManager from '../roomManager.js';
import { cancelCountdown } from './countdown.js';

const leaveRoom = (io, socket, payload) => {
    try {
        const { roomId } = payload;
        const { id: userId, username } = socket.user;

        const room = roomManager.getRoom(roomId);
        if (!room) {
            return socket.emit('error', { message: 'Room not found in active session.' });
        }

        // Cancel any running countdown before changing membership
        cancelCountdown(io, roomId);

        const { isEmpty, wasHost, nextHostId } = roomManager.removeMember(roomId, userId);

        socket.leave(roomId);
        console.log(`[Socket]: ${username} left room ${roomId}`);

        if (isEmpty) {
            // Room is gone — nothing to broadcast
            return;
        }

        // Notify remaining players that this user left
        io.to(roomId).emit('player-left', { userId, username });

        // If host left, inform the room of the new host
        if (wasHost && nextHostId) {
            io.to(roomId).emit('host-migrated', { newHostId: nextHostId });
            console.log(`[Socket]: Host migrated to ${nextHostId} in room ${roomId}`);
        }
    } catch (err) {
        console.error('[Socket][leaveRoom] error:', err);
        socket.emit('error', { message: 'Failed to leave room.' });
    }
};

export default leaveRoom;
