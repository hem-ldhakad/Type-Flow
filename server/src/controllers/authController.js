import * as authService from '../services/authService.js';

export const register = async (req, res, next) => {
    try {
        const { username, email, password } = req.body;
        const result = await authService.createUser({ username, email, password });

        res.status(201).json({
            success: true,
            message: 'Registration successful.',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

export const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const result = await authService.authenticateUser({ email, password });

        res.status(200).json({
            success: true,
            message: 'Login successful.',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

export const getMe = async (req, res, next) => {
    try {
        // req.user has already been loaded, verified and decorated on the request object by the auth middleware
        res.status(200).json({
            success: true,
            message: 'Profile retrieved successfully.',
            data: {
                user: req.user
            }
        });
    } catch (error) {
        next(error);
    }
};
