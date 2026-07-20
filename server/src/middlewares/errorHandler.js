import { config } from '../config/index.js';

// 404 Not Found error interceptor
export const notFoundHandler = (req, res, next) => {
    const error = new Error(`Resource Not Found - ${req.originalUrl}`);
    error.status = 404;
    next(error);
};

// Global error catcher yielding formatted JSON envelopes
export const errorHandler = (err, req, res, next) => {
    const statusCode = err.status || 500;

    // Console logging telemetry
    if (config.nodeEnv === 'development') {
        console.error(`[Express Handler]: ${err.message}\n`, err.stack);
    } else {
        console.error(`[Express Handler]: ${err.message}`);
    }

    res.status(statusCode).json({
        success: false,
        message: err.message || 'Internal Server Error',
        stack: config.nodeEnv === 'development' ? err.stack : undefined
    });
};
