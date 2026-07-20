import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import * as authService from '../services/authService.js';

// Authorization gateway middleware enforcing valid JWT bearer headers
export const authRequired = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            const error = new Error('Authorization token not found. Format: Bearer <token>.');
            error.status = 401;
            return next(error);
        }

        const token = authHeader.split(' ')[1];

        let decoded;
        try {
            decoded = jwt.verify(token, config.jwtSecret);
        } catch (err) {
            const error = new Error('Session key invalid or expired.');
            error.status = 401;
            return next(error);
        }

        // Validate containing user instance exists in the database
        const user = await authService.getUserById(decoded.id);

        // Attach profile information onto the request payload
        req.user = user;

        next();
    } catch (error) {
        next(error);
    }
};
