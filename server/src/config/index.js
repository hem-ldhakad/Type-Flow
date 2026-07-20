import dotenv from 'dotenv';
import crypto from 'crypto';

// Load environmental variables
dotenv.config();

// ── Validate required environment variables ───────────────────────────────────
const REQUIRED = ['DATABASE_URL', 'JWT_SECRET'];
for (const key of REQUIRED) {
    if (!process.env[key]) {
        console.error(`[Config]: FATAL — missing required environment variable: ${key}`);
        process.exit(1);
    }
}

// Warn if JWT_SECRET is the well-known placeholder
if (process.env.JWT_SECRET?.toLowerCase().includes('change_me') ||
    process.env.JWT_SECRET?.toLowerCase().includes('secret_here') ||
    process.env.JWT_SECRET?.toLowerCase().includes('replace_with')) {
    console.warn('[Config]: WARNING — JWT_SECRET appears to be a placeholder. Change it in production!');
}

export const config = {
    port: parseInt(process.env.PORT || '5000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',
    databaseUrl: process.env.DATABASE_URL,
    jwtSecret: process.env.JWT_SECRET,
    corsOrigin: process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? null : '*'),
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
};

// In production, corsOrigin must be explicitly set
if (config.isProduction && !process.env.CORS_ORIGIN) {
    console.warn('[Config]: WARNING — CORS_ORIGIN is not set in production. CORS will be disabled for all origins!');
}
