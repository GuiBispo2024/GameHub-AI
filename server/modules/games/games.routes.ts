import { Router } from 'express';
import { GamesController } from './games.controller';

export const gamesRouter = Router();
const controller = new GamesController();

// 1. Search games with pagination and filtering
gamesRouter.get('/search', controller.search);

// 2. Metadata / filter lists
gamesRouter.get('/genres', controller.getGenres);
gamesRouter.get('/platforms', controller.getPlatforms);

// 3. Lookup by external IGDB ID
gamesRouter.get('/igdb/:igdbId', controller.getByIgdbId);

// 4. Lookup by internal PostgreSQL UUID
gamesRouter.get('/:id', controller.getById);
