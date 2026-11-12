import { Router } from 'express';
import { AuthController } from './auth.controller';
import { requireAuth } from '../../middlewares/auth.middleware';
import { authLimiter } from '../../middlewares/rate-limit.middleware';

export const authRouter = Router();

// Public auth endpoints with brute-force rate limiting
authRouter.post('/register', authLimiter, AuthController.register);
authRouter.post('/login', authLimiter, AuthController.login);
authRouter.post('/logout', AuthController.logout);

// Protected session check
authRouter.get('/me', requireAuth, AuthController.me);
