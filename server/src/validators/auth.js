// Registration inputs validation middleware
export const validateRegister = (req, res, next) => {
    const { username, email, password } = req.body;

    if (!username || typeof username !== 'string' || username.trim().length < 3) {
        const error = new Error('Username must be a string with a minimum length of 3 characters.');
        error.status = 400;
        return next(error);
    }

    // Alphanumeric format check for usernames (no special chars targeting databases/systems)
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(username.trim())) {
        const error = new Error('Username can only contain alphanumeric characters and underscores.');
        error.status = 400;
        return next(error);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== 'string' || !emailRegex.test(email)) {
        const error = new Error('A valid email address is required.');
        error.status = 400;
        return next(error);
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
        const error = new Error('Password must be at least 6 characters long.');
        error.status = 400;
        return next(error);
    }

    // Sanitize and save back to body
    req.body.username = username.trim();
    req.body.email = email.trim().toLowerCase();

    next();
};

// Login inputs validation middleware
export const validateLogin = (req, res, next) => {
    const { email, password } = req.body;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== 'string' || !emailRegex.test(email)) {
        const error = new Error('A valid email address is required.');
        error.status = 400;
        return next(error);
    }

    if (!password || typeof password !== 'string' || !password.trim()) {
        const error = new Error('Password is required.');
        error.status = 400;
        return next(error);
    }

    req.body.email = email.trim().toLowerCase();

    next();
};
