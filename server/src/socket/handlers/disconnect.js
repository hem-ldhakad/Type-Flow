import * as roomManager from '../roomManager.js';
import { cancelCountdown } from './countdown.js';

const disconnect = (io, socket) => {
    try {
        const userId = socket.user?.id;
        const username = socket.user?.username;

        // Reverse-lookup which room this socket belonged to
        const lookup = roomManager.getRoomBySocketId(socket.id);
        if (!lookup) {
            // Socket was not in any active room (e.g. disconnected before joining)
            return;
        }

        const { roomId } = lookup;
        console.log(`[Socket]: ${username} disconnected from room ${roomId}`);

        // Cancel any running countdown before mutating membership
        cancelCountdown(io, roomId);

        const { isEmpty, wasHost, nextHostId } = roomManager.removeMember(roomId, userId);

        // Notify remaining players of the disconnection
        if (!isEmpty) {
            io.to(roomId).emit('player-disconnected', { userId, username });

            if (wasHost && nextHostId) {
                io.to(roomId).emit('host-migrated', { newHostId: nextHostId });
                console.log(`[Socket]: Host migrated to ${nextHostId} in room ${roomId} after disconnect`);
            }
        }
    } catch (err) {
        console.error('[Socket][disconnect] error:', err);
    }
};

export default disconnect;
