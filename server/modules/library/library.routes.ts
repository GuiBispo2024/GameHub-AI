import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware';
import { LibraryController } from './library.controller';

export const libraryRouter = Router();
const controller = new LibraryController();

// All library endpoints strictly require authentication
libraryRouter.use(requireAuth);

// Stats route MUST be mounted before /:id to avoid parameter route collision
libraryRouter.get('/stats', controller.getStats);

// Collection endpoints
libraryRouter.post('/', controller.addGame);
libraryRouter.get('/', controller.list);

// Single entry endpoints (by UserGame UUID)
libraryRouter.get('/:id', controller.getById);
libraryRouter.patch('/:id', controller.update);
libraryRouter.delete('/:id', controller.remove);
