import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware';
import { agentLimiter } from '../../middlewares/rate-limit.middleware';
import { AgentController } from './agent.controller';

export const agentRouter = Router();

// All GameAgent routes require authenticated gamer account
agentRouter.use(requireAuth);

agentRouter.post('/chat', agentLimiter, AgentController.chat);
agentRouter.get('/conversations', AgentController.listConversations);
agentRouter.get('/conversations/:id', AgentController.getConversation);
agentRouter.delete('/conversations/:id', AgentController.deleteConversation);
agentRouter.post('/actions/:id/confirm', AgentController.confirmAction);
agentRouter.post('/actions/:id/cancel', AgentController.cancelAction);
