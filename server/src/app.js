import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import { config } from './config/index.js';
import { notFoundHandler, errorHandler } from './middlewares/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import roomRoutes from './routes/roomRoutes.js';
import matchRoutes from './routes/matchRoutes.js';
import userRoutes from './routes/userRoutes.js';

const app = express();

// ── Security headers via Helmet ───────────────────────────────────────────────
app.use(helmet());

// ── Gzip compression for all responses ───────────────────────────────────────
app.use(compression());

// ── Trust proxy (required for correct IP behind load balancer/nginx) ─────────
if (config.isProduction) {
    app.set('trust proxy', 1);
}

// ── Cross-Origin access rules ─────────────────────────────────────────────────
const allowedOrigins = config.corsOrigin
    ? config.corsOrigin.split(',').map((o) => o.trim())
    : [];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests without an origin (e.g. server-to-server, Postman in dev)
        if (!origin) return callback(null, true);
        if (!config.isProduction) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`CORS: Origin '${origin}' not allowed.`));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
}));

// ── Global API Rate Limiting ──────────────────────────────────────────────────
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,           // 15 minutes
    max: config.rateLimitMax,            // Max requests per window per IP
    standardHeaders: true,               // Return rate limit info in headers
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, please try again later.' },
});

// Auth-specific stricter limiter (prevent brute force)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many authentication attempts, please try again in 15 minutes.' },
});

app.use('/api', globalLimiter);

// ── Parse payloads ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));     // Prevent oversized JSON payloads
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ── Morgan request logging ────────────────────────────────────────────────────
if (config.nodeEnv === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

// ── Health status ping endpoint ───────────────────────────────────────────────
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'UP',
        environment: config.nodeEnv,
        timestamp: new Date().toISOString(),
        uptime: Math.round(process.uptime()),
    });
});

// ── Mount API Routes ──────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/users', userRoutes);

// ── Fallback handlers ─────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
