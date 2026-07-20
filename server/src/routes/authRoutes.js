import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { validateRegister, validateLogin } from '../validators/auth.js';
import { authRequired } from '../middlewares/auth.js';

const router = Router();

// Registration endpoint
router.post('/register', validateRegister, authController.register);

// Login endpoint
router.post('/login', validateLogin, authController.login);

// Profile endpoint
router.get('/me', authRequired, authController.getMe);

export default router;
