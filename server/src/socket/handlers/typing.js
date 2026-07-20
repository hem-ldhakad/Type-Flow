import * as roomManager from '../roomManager.js';
import prisma from '../../prisma.js';

const saveMatchResults = async (roomId, room) => {
    const results = roomManager.getRaceResults(roomId);

    return prisma.$transaction(async (tx) => {
        // 1. Create central Match record
        const match = await tx.match.create({
            data: {
                roomId: roomId,
                paragraphId: room.paragraphId,
                startedAt: new Date(room.matchStartedAt),
                endedAt: new Date()
            }
        });

        // 2. Map and insert nested Result records and increment player level/XP records
        for (const player of results) {
            await tx.result.create({
                data: {
                    matchId: match.id,
                    userId: player.userId,
                    wpm: player.wpm,
                    accuracy: player.accuracy,
                    position: player.position,
                    wpmHistory: JSON.stringify(player.wpmHistory || []),      // Save the actual WPM history array
                    keystrokeHistory: '[]' // Fallback structural placeholders for SQLite string
                }
            });

            // Gather current progression details
            const user = await tx.user.findUnique({
                where: { id: player.userId },
                select: { xp: true, level: true }
            });

            if (user) {
                // Progression math:
                // Base finishing reward: +20 XP
                // Position 1 (Winner) multiplier: +50 XP
                // Speed modifier: +1 XP per 5 WPM
                const baseXP = 20;
                const winnerXP = player.position === 1 ? 50 : 0;
                const speedXP = Math.floor(player.wpm / 5);

                const rewardXP = baseXP + winnerXP + speedXP;
                let newXp = user.xp + rewardXP;
                let newLevel = user.level;

                // Loop processing: Level L requires L * 100 XP to reach L+1
                while (newXp >= newLevel * 100) {
                    newXp -= newLevel * 100;
                    newLevel += 1;
                }

                await tx.user.update({
                    where: { id: player.userId },
                    data: { xp: newXp, level: newLevel }
                });
            }
        }

        // 3. Update the persistent DB Room state back to LOBBY
        await tx.room.update({
            where: { id: roomId },
            data: { status: 'LOBBY' }
        });

        return { matchId: match.id, results };
    });
};

const typing = async (io, socket, payload) => {
    try {
        const { roomId, typedText, totalKeystrokes } = payload;
        const { id: userId } = socket.user;

        const room = roomManager.getRoom(roomId);
        if (!room) {
            return socket.emit('error', { message: 'Room not found in active session.' });
        }

        if (room.status !== 'RACING') {
            return socket.emit('error', { message: 'Race is not currently active.' });
        }

        // Call authoritative helper to update metric states in mem-cache
        const update = roomManager.updatePlayerProgress(roomId, userId, typedText, totalKeystrokes);
        if (!update) return;

        // Broadcast standard progress update to all other room members
        io.to(roomId).emit('progress-update', {
            userId,
            progressPercentage: update.progress,
            currentWpm: update.wpm
        });

        // Completion check triggers
        if (update.finished) {
            // Fetch rank based on completed standings count
            const currentStandings = roomManager.getRaceResults(roomId);
            const position = currentStandings.find(p => p.userId === userId)?.position || currentStandings.length;

            io.to(roomId).emit('player-finished', {
                userId,
                username: update.username,
                rank: position,
                wpm: update.wpm,
                accuracy: update.accuracy
            });

            console.log(`[Socket]: Player ${update.username} finished in position ${position} with ${update.wpm} WPM`);

            // If all players are done typing, trigger database persist and terminate matching state
            if (roomManager.allFinished(roomId)) {
                console.log(`[Socket]: All players finished. Saving match results for room ${roomId}...`);

                try {
                    const summary = await saveMatchResults(roomId, room);

                    // Reset room status in the in-memory manager
                    roomManager.setStatus(roomId, 'LOBBY');

                    // Broadcast final match wrapup metrics and result records
                    io.to(roomId).emit('game-end', {
                        matchId: summary.matchId,
                        results: summary.results
                    });

                    console.log(`[Socket]: Race ended in room ${roomId}. Standings broadcasted.`);
                } catch (dbError) {
                    console.error('[Socket][typing] Error saving match results:', dbError);
                    io.to(roomId).emit('error', { message: 'System failed to save match results.' });
                }
            }
        }
    } catch (err) {
        console.error('[Socket][typing] error:', err);
        socket.emit('error', { message: 'Typing tracking sync failed.' });
    }
};

export default typing;
