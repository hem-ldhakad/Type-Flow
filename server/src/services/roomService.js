import prisma from '../prisma.js';

// Generates a random uppercase 6-character room code
const generateRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};

// Sanitizes room member profiles returned to the client
const sanitizeMember = ({ id, username, xp, level }) => ({ id, username, xp, level });

export const createRoom = async ({ hostId, configDuration = 30, configMode = 'WORDS', configWordCount = 50 }) => {
    // Ensure to mint a collision-free unique room code
    let code;
    let attempts = 0;
    do {
        code = generateRoomCode();
        const existing = await prisma.room.findUnique({ where: { code } });
        if (!existing) break;
        attempts++;
        if (attempts > 10) throw new Error('Failed to generate a unique room code. Please try again.');
    } while (true);

    // Create room and immediately mark host as an active member in same transaction
    const room = await prisma.room.create({
        data: {
            code,
            hostId,
            status: 'LOBBY',
            configDuration,
            configMode,
            configWordCount,
            members: {
                connect: { id: hostId }
            }
        },
        include: {
            members: true,
            host: { select: { id: true, username: true } }
        }
    });

    return {
        ...room,
        members: room.members.map(sanitizeMember)
    };
};

export const joinRoom = async ({ code, userId }) => {
    const room = await prisma.room.findUnique({
        where: { code },
        include: { members: true }
    });

    if (!room) {
        const error = new Error(`Room with code '${code}' not found.`);
        error.status = 404;
        throw error;
    }

    // Prevent joining a race already in progress or finished
    if (room.status !== 'LOBBY') {
        const error = new Error(`Room is not currently accepting players. Status: ${room.status}.`);
        error.status = 409;
        throw error;
    }

    // Idempotent: if already a member, just return the current room state
    const alreadyMember = room.members.some(m => m.id === userId);
    if (alreadyMember) {
        return { ...room, members: room.members.map(sanitizeMember) };
    }

    const updated = await prisma.room.update({
        where: { id: room.id },
        data: {
            members: { connect: { id: userId } }
        },
        include: {
            members: true,
            host: { select: { id: true, username: true } }
        }
    });

    return {
        ...updated,
        members: updated.members.map(sanitizeMember)
    };
};

export const leaveRoom = async ({ roomId, userId }) => {
    const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: { members: true }
    });

    if (!room) {
        const error = new Error('Room not found.');
        error.status = 404;
        throw error;
    }

    const isMember = room.members.some(m => m.id === userId);
    if (!isMember) {
        const error = new Error('You are not a member of this room.');
        error.status = 403;
        throw error;
    }

    // Disconnect user from the room
    await prisma.room.update({
        where: { id: roomId },
        data: { members: { disconnect: { id: userId } } }
    });

    // Recalculate remaining members after disconnect
    const remainingMembers = room.members.filter(m => m.id !== userId);

    // If room is now empty, disband it permanently
    if (remainingMembers.length === 0) {
        await prisma.room.delete({ where: { id: roomId } });
        return { disbanded: true, roomId };
    }

    // If the leaving user was the host, migrate host to the next oldest remaining member
    if (room.hostId === userId) {
        const newHost = remainingMembers[0];
        await prisma.room.update({
            where: { id: roomId },
            data: { hostId: newHost.id }
        });
        return { disbanded: false, newHostId: newHost.id, roomId };
    }

    return { disbanded: false, roomId };
};

export const getRoom = async (roomId) => {
    const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: {
            host: { select: { id: true, username: true } },
            members: true
        }
    });

    if (!room) {
        const error = new Error('Room not found.');
        error.status = 404;
        throw error;
    }

    return {
        ...room,
        members: room.members.map(sanitizeMember)
    };
};
