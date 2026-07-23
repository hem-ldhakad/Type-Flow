import { Router } from 'express';
import * as userController from '../controllers/userController.js';
import { authRequired } from '../middlewares/auth.js';

const router = Router();

// Public: global and weekly leaderboard (?period=all|week)
// NOTE: must be declared before /:id/stats to avoid route collision
router.get('/leaderboard', userController.getLeaderboard);

// Authenticated: per-user profile stats
router.get('/:id/stats', authRequired, userController.getUserStats);

// Authenticated: delete user account
router.delete('/:id', authRequired, userController.deleteUser);

export default router;
