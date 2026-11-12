import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware';
import { JourneysController } from './journeys.controller';

const controller = new JourneysController();

// Mounted at /api/journeys
export const journeysRouter = Router();
journeysRouter.use(requireAuth);

journeysRouter.post('/', controller.createJourney);
journeysRouter.get('/', controller.listJourneys);
journeysRouter.get('/:id', controller.getJourneyById);
journeysRouter.patch('/:id', controller.updateJourney);
journeysRouter.patch('/:id/activate', controller.activateJourney);
journeysRouter.delete('/:id', controller.deleteJourney);

// Journey Progress Logs
journeysRouter.get('/:id/progress', controller.listProgress);
journeysRouter.post('/:id/progress', controller.createProgress);

// Journey Builds
journeysRouter.get('/:id/builds', controller.listBuilds);
journeysRouter.post('/:id/builds', controller.createBuild);

// Mounted at /api/progress
export const progressRouter = Router();
progressRouter.use(requireAuth);
progressRouter.patch('/:id', controller.updateProgress);
progressRouter.delete('/:id', controller.deleteProgress);

// Mounted at /api/builds
export const buildsRouter = Router();
buildsRouter.use(requireAuth);
buildsRouter.get('/:id', controller.getBuildById);
buildsRouter.patch('/:id', controller.updateBuild);
buildsRouter.delete('/:id', controller.deleteBuild);
