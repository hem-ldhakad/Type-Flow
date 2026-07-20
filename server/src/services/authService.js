import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../prisma.js';
import { config } from '../config/index.js';

// Helper generating signature JWT tokens valid for 24 hours
const generateToken = (user) => {
    return jwt.sign(
        { id: user.id, username: user.username },
        config.jwtSecret,
        { expiresIn: '24h' }
    );
};

// Sanitizer utility removing password hashes from user responses
const sanitizeUser = (user) => {
    const { password, ...sanitized } = user;
    return sanitized;
};

export const createUser = async ({ username, email, password }) => {
    // Assert distinct credentials checks
    const existingUser = await prisma.user.findFirst({
        where: {
            OR: [
                { email },
                { username }
            ]
        }
    });

    if (existingUser) {
        const field = existingUser.email === email ? 'Email' : 'Username';
        const error = new Error(`${field} is already registered.`);
        error.status = 400;
        throw error;
    }

    // Hash target user password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Store profile in database
    const user = await prisma.user.create({
        data: {
            username,
            email,
            password: hashedPassword
        }
    });

    const token = generateToken(user);
    return { user: sanitizeUser(user), token };
};

export const authenticateUser = async ({ email, password }) => {
    // Query user record
    const user = await prisma.user.findUnique({
        where: { email }
    });

    if (!user) {
        const error = new Error('Invalid email or password.');
        error.status = 401;
        throw error;
    }

    // Verify passwords matches
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        const error = new Error('Invalid email or password.');
        error.status = 401;
        throw error;
    }

    const token = generateToken(user);
    return { user: sanitizeUser(user), token };
};

export const getUserById = async (id) => {
    const user = await prisma.user.findUnique({
        where: { id },
        select: {
            id: true,
            username: true,
            email: true,
            xp: true,
            level: true,
            createdAt: true
        }
    });

    if (!user) {
        const error = new Error('User profile not found.');
        error.status = 404;
        throw error;
    }

    return user;
};
