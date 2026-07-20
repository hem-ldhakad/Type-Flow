import * as roomService from '../services/roomService.js';

export const createRoom = async (req, res, next) => {
    try {
        const { configDuration, configMode, configWordCount } = req.body;
        // Host identity sourced securely from the validated JWT on req.user
        const hostId = req.user.id;

        const room = await roomService.createRoom({ hostId, configDuration, configMode, configWordCount });

        res.status(201).json({
            success: true,
            message: 'Room created successfully.',
            data: { room }
        });
    } catch (error) {
        next(error);
    }
};

export const joinRoom = async (req, res, next) => {
    try {
        const { code } = req.body;
        const userId = req.user.id;

        const room = await roomService.joinRoom({ code, userId });

        res.status(200).json({
            success: true,
            message: 'Joined room successfully.',
            data: { room }
        });
    } catch (error) {
        next(error);
    }
};

export const leaveRoom = async (req, res, next) => {
    try {
        const { id: roomId } = req.params;
        const userId = req.user.id;

        const result = await roomService.leaveRoom({ roomId, userId });

        res.status(200).json({
            success: true,
            message: result.disbanded ? 'Room disbanded — last player left.' : 'Left room successfully.',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

export const getRoom = async (req, res, next) => {
    try {
        const { id: roomId } = req.params;

        const room = await roomService.getRoom(roomId);

        res.status(200).json({
            success: true,
            message: 'Room details retrieved.',
            data: { room }
        });
    } catch (error) {
        next(error);
    }
};
