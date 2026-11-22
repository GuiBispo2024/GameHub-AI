import { Router } from 'express';
import { requireAdmin, requireAuth } from '../../middlewares/auth.middleware';
import { KnowledgeController } from './knowledge.controller';

export const knowledgeRouter = Router();

// All knowledge base administration routes require authenticated ADMIN user
knowledgeRouter.use(requireAuth, requireAdmin);

knowledgeRouter.post('/guides', KnowledgeController.createGuide);
knowledgeRouter.get('/guides', KnowledgeController.listGuides);
knowledgeRouter.get('/guides/:id', KnowledgeController.getGuide);
knowledgeRouter.patch('/guides/:id', KnowledgeController.updateGuide);
knowledgeRouter.post('/guides/:id/rechunk', KnowledgeController.rechunkGuide);
knowledgeRouter.delete('/guides/:id', KnowledgeController.deleteGuide);
