import { Router } from 'express';
import { healthRouter } from './health.routes';
import { gamesRouter } from '../modules/games/games.routes';
import { libraryRouter } from '../modules/library/library.routes';
import { journeysRouter, progressRouter, buildsRouter } from '../modules/journeys/journeys.routes';
import { agentRouter } from '../modules/agent/agent.routes';
import { companionRouter } from '../modules/companion/companion.routes';
import { authRouter } from '../modules/auth/auth.routes';
import { userRouter } from '../modules/users/user.routes';
import { swaggerRouter } from '../docs/swagger.routes';

export const apiRouter = Router();

// Interactive API Documentation (OpenAPI / Swagger)
apiRouter.use(swaggerRouter);

// Health check endpoint
apiRouter.use('/health', healthRouter);

// Authentication & Gamer Profile Modules
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', userRouter);

// Game Catalog, Personal Library & Gameplay Journeys Modules
apiRouter.use('/games', gamesRouter);
apiRouter.use('/library', libraryRouter);
apiRouter.use('/journeys', journeysRouter);
apiRouter.use('/progress', progressRouter);
apiRouter.use('/builds', buildsRouter);

// GameAgent & Gemini AI Companion Module
apiRouter.use('/agent', agentRouter);
apiRouter.use('/companion', companionRouter);
