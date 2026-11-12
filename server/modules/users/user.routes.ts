import { Router } from 'express';
import { UserController } from './user.controller';
import { requireAuth } from '../../middlewares/auth.middleware';

export const userRouter = Router();

// All user profile and preferences routes strictly require authentication
userRouter.use(requireAuth);

userRouter.get('/me', UserController.getMe);
userRouter.patch('/me', UserController.updateMe);
userRouter.get('/me/preferences', UserController.getPreferences);
userRouter.patch('/me/preferences', UserController.updatePreferences);
