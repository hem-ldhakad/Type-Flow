import { Router } from 'express';
import * as roomController from '../controllers/roomController.js';
import { validateCreateRoom, validateJoinRoom } from '../validators/room.js';
import { authRequired } from '../middlewares/auth.js';

const router = Router();

// All room routes require a valid JWT session
router.use(authRequired);

// POST /api/rooms — Create a new lobby room
router.post('/', validateCreateRoom, roomController.createRoom);

// POST /api/rooms/join — Join a room by code. Must be defined before /:id routes.
router.post('/join', validateJoinRoom, roomController.joinRoom);

// POST /api/rooms/:id/leave — Leave a room
router.post('/:id/leave', roomController.leaveRoom);

// GET /api/rooms/:id — Fetch room details and member list
router.get('/:id', roomController.getRoom);

export default router;
