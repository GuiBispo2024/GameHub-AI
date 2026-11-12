import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { GamesService } from './games.service';
import {
  searchGamesQuerySchema,
  gameUuidParamSchema,
  igdbIdParamSchema,
} from './games.schema';

const defaultGamesService = new GamesService();

export class GamesController {
  private service: GamesService;

  constructor(service?: GamesService) {
    this.service = service || defaultGamesService;
  }

  search = async (req: Request, res: Response): Promise<void> => {
    try {
      const validatedQuery = searchGamesQuerySchema.parse(req.query);
      const result = await this.service.searchGames(validatedQuery);
      res.status(200).json(result);
    } catch (err: any) {
      if (err instanceof ZodError) {
        res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros de busca inválidos.',
          errors: err.flatten().fieldErrors,
        });
        return;
      }

      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({
        status: 'error',
        code: err.code || 'SEARCH_ERROR',
        message: err.message || 'Erro ao realizar busca de jogos.',
      });
    }
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = gameUuidParamSchema.parse(req.params);
      const game = await this.service.getGameById(id);

      if (!game) {
        res.status(404).json({
          status: 'error',
          code: 'GAME_NOT_FOUND',
          message: 'Jogo não encontrado.',
        });
        return;
      }

      res.status(200).json({
        status: 'success',
        data: game,
      });
    } catch (err: any) {
      if (err instanceof ZodError) {
        res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          message: 'Identificador de jogo inválido.',
          errors: err.flatten().fieldErrors,
        });
        return;
      }

      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({
        status: 'error',
        code: err.code || 'GAME_FETCH_ERROR',
        message: err.message || 'Erro ao buscar detalhes do jogo.',
      });
    }
  };

  getByIgdbId = async (req: Request, res: Response): Promise<void> => {
    try {
      const { igdbId } = igdbIdParamSchema.parse(req.params);
      const game = await this.service.getGameByIgdbId(igdbId);

      if (!game) {
        res.status(404).json({
          status: 'error',
          code: 'GAME_NOT_FOUND',
          message: 'Jogo não encontrado no catálogo IGDB.',
        });
        return;
      }

      res.status(200).json({
        status: 'success',
        data: game,
      });
    } catch (err: any) {
      if (err instanceof ZodError) {
        res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          message: 'Identificador IGDB inválido.',
          errors: err.flatten().fieldErrors,
        });
        return;
      }

      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({
        status: 'error',
        code: err.code || 'IGDB_FETCH_ERROR',
        message: err.message || 'Erro ao buscar jogo na IGDB.',
      });
    }
  };

  getGenres = async (_req: Request, res: Response): Promise<void> => {
    try {
      const genres = await this.service.getGenres();
      res.status(200).json({
        status: 'success',
        data: genres,
      });
    } catch (err: any) {
      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({
        status: 'error',
        code: err.code || 'GENRES_FETCH_ERROR',
        message: err.message || 'Erro ao carregar gêneros.',
      });
    }
  };

  getPlatforms = async (_req: Request, res: Response): Promise<void> => {
    try {
      const platforms = await this.service.getPlatforms();
      res.status(200).json({
        status: 'success',
        data: platforms,
      });
    } catch (err: any) {
      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({
        status: 'error',
        code: err.code || 'PLATFORMS_FETCH_ERROR',
        message: err.message || 'Erro ao carregar plataformas.',
      });
    }
  };
}
