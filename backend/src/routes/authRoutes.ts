import { Router } from 'express';
import { loginHandler, getCurrentUser, verifyTokenHandler } from '../controllers/authController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

// Public routes (no authentication required)
router.post('/login', loginHandler);
router.post('/verify', verifyTokenHandler);

// Protected routes (authentication required)
router.get('/me', authenticate, getCurrentUser);

export default router;
