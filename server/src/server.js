import http from 'http';
import app from './app.js';
import { config } from './config/index.js';
import { initSocket } from './socket/index.js';

// Wrap Express in a raw HTTP server so Socket.IO can share the same port
const httpServer = http.createServer(app);

// Attach Socket.IO to the HTTP server
initSocket(httpServer);

httpServer.listen(config.port, () => {
    console.log(`[Server]: TypeFlow backend listening on port ${config.port} in ${config.nodeEnv} mode`);
});

// Handle SIGTERM signal for graceful shutdown
process.on('SIGTERM', () => {
    console.log('[Server]: SIGTERM signal received. Commencing graceful shutdown...');
    httpServer.close(() => {
        console.log('[Server]: Server processes terminated.');
    });
});


// Trigger restart

// Trigger restart for solo play
