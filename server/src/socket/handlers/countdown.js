import * as roomManager from '../roomManager.js';
import prisma from '../../prisma.js';
import { generateParagraph } from '../../services/paragraphService.js';

const COUNTDOWN_SECONDS = 5;

export const startCountdown = (io, roomId) => {
    // Guard against double-starting if already in countdown
    const currentStatus = roomManager.getStatus(roomId);
    if (currentStatus === 'COUNTDOWN' || currentStatus === 'RACING') return;

    roomManager.setStatus(roomId, 'COUNTDOWN');
    console.log(`[Socket]: Countdown started for room ${roomId}`);

    let timeRemaining = COUNTDOWN_SECONDS;

    // Emit the first tick immediately, then every second
    io.to(roomId).emit('countdown', { timeRemaining });

    const timer = setInterval(async () => {
        timeRemaining -= 1;

        if (timeRemaining > 0) {
            io.to(roomId).emit('countdown', { timeRemaining });
            return;
        }

        try {
            // Find room settings config
            const roomConfig = await prisma.room.findUnique({
                where: { id: roomId },
                select: { configWordCount: true }
            });
            const wordCount = roomConfig?.configWordCount || 50;

            // Pick a paragraph matching the room configuration
            const paragraph = await generateParagraph(wordCount);

            // Countdown completed — transition to RACING and initialize race state
            clearInterval(timer);
            roomManager.setCountdownTimer(roomId, null);
            roomManager.startRace(roomId, paragraph.id, paragraph.text);

            io.to(roomId).emit('game-start', {
                paragraphId: paragraph.id,
                paragraphText: paragraph.text
            });

            console.log(`[Socket]: Game started in room ${roomId} with paragraph ${paragraph.id}`);
        } catch (err) {
            clearInterval(timer);
            roomManager.setCountdownTimer(roomId, null);
            console.error('[Socket][countdown] error fetching paragraph:', err);
            io.to(roomId).emit('error', { message: 'Failed to start game. Please try again.' });
            roomManager.setStatus(roomId, 'LOBBY');
        }
    }, 1000);

    roomManager.setCountdownTimer(roomId, timer);
};

export const cancelCountdown = (io, roomId) => {
    const room = roomManager.getRoom(roomId);
    if (!room || room.status !== 'COUNTDOWN') return;

    roomManager.clearCountdown(roomId);
    roomManager.setStatus(roomId, 'LOBBY');
    console.log(`[Socket]: Countdown cancelled for room ${roomId}`);
};
