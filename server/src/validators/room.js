const VALID_DURATIONS = [15, 30, 60, 120];
const VALID_MODES = ['WORDS', 'TIME'];
const VALID_WORD_COUNTS = [10, 25, 50, 100];

// Validates optional room configuration fields on creation
export const validateCreateRoom = (req, res, next) => {
    const { configDuration, configMode, configWordCount } = req.body;

    if (configDuration !== undefined) {
        if (!Number.isInteger(configDuration) || !VALID_DURATIONS.includes(configDuration)) {
            const error = new Error(`configDuration must be one of: ${VALID_DURATIONS.join(', ')}.`);
            error.status = 400;
            return next(error);
        }
    }

    if (configMode !== undefined) {
        if (!VALID_MODES.includes(configMode)) {
            const error = new Error(`configMode must be one of: ${VALID_MODES.join(', ')}.`);
            error.status = 400;
            return next(error);
        }
    }

    if (configWordCount !== undefined) {
        if (!Number.isInteger(configWordCount) || !VALID_WORD_COUNTS.includes(configWordCount)) {
            const error = new Error(`configWordCount must be one of: ${VALID_WORD_COUNTS.join(', ')}.`);
            error.status = 400;
            return next(error);
        }
    }

    next();
};

// Validates room code presence on join requests
export const validateJoinRoom = (req, res, next) => {
    const { code } = req.body;

    if (!code || typeof code !== 'string' || code.trim().length === 0) {
        const error = new Error('Room code is required.');
        error.status = 400;
        return next(error);
    }

    req.body.code = code.trim().toUpperCase();
    next();
};
