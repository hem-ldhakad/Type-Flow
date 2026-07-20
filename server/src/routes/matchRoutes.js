import { Router } from 'express';
import * as matchController from '../controllers/matchController.js';
import { authRequired } from '../middlewares/auth.js';

const router = Router();

// Retrieve paginated matches played by the authenticated user
router.get('/', authRequired, matchController.getUserMatches);

// Retrieve a random paragraph for solo practice
router.get('/paragraph/random', authRequired, matchController.getRandomParagraph);

// Record solo match results
router.post('/solo', authRequired, matchController.submitSoloMatch);

export default router;
