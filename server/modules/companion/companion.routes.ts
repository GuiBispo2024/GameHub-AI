import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware';
import { AgentController } from '../agent/agent.controller';

export const companionRouter = Router();

// Backward-compatible alias for listing active GameAgent companion sessions
companionRouter.get('/sessions', requireAuth, AgentController.listConversations);
