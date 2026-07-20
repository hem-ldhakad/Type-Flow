import * as roomManager from '../roomManager.js';
import { startCountdown, cancelCountdown } from './countdown.js';
import prisma from '../../prisma.js';

const joinRoom = async (io, socket, payload) => {
    try {
        const { roomId } = payload;
        const { id: userId, username } = socket.user;

        // Validate the room exists in the DB and is in LOBBY status
        const dbRoom = await prisma.room.findUnique({ where: { id: roomId } });
        if (!dbRoom) {
            return socket.emit('error', { message: `Room '${roomId}' not found.` });
        }
        if (dbRoom.status !== 'LOBBY') {
            return socket.emit('error', { message: `Room is not accepting players. Status: ${dbRoom.status}.` });
        }

        // Bootstrap the in-memory room if the host is joining fresh
        if (!roomManager.roomExists(roomId)) {
            roomManager.createSocketRoom(roomId, dbRoom.hostId, dbRoom.code);
        }

        // Add member to in-memory state and join the socket.io channel
        roomManager.addMember(roomId, userId, socket.id, username);
        socket.join(roomId);

        // Confirm to joining player their entry with the current member list
        const members = roomManager.getMembersArray(roomId);
        const room = roomManager.getRoom(roomId);
        socket.emit('room-joined', {
            roomId,
            code: dbRoom.code,
            members,
            isSolo: room ? !!room.isSolo : false
        });

        // Notify all others in the room of the new arrival
        socket.to(roomId).emit('player-joined', { userId, username });

        console.log(`[Socket]: ${username} joined room ${dbRoom.code}`);
    } catch (err) {
        console.error('[Socket][joinRoom] error:', err);
        socket.emit('error', { message: 'Failed to join room.' });
    }
};

export default joinRoom;
