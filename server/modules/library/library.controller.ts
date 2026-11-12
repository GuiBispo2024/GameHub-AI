import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { LibraryService } from './library.service';
import {
  addLibraryGameSchema,
  updateLibraryGameSchema,
  libraryEntryIdParamSchema,
  libraryQuerySchema,
} from './library.schema';

const defaultLibraryService = new LibraryService();

export class LibraryController {
  private service: LibraryService;

  constructor(service?: LibraryService) {
    this.service = service || defaultLibraryService;
  }

  addGame = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user?.id) {
        res.status(401).json({
          status: 'error',
          code: 'UNAUTHORIZED',
          message: 'Usuário não autenticado.',
        });
        return;
      }

      const validated = addLibraryGameSchema.parse(req.body);
      const entry = await this.service.addGame(req.user.id, validated);

      res.status(201).json({
        status: 'success',
        message: 'Jogo adicionado à biblioteca com sucesso.',
        data: entry,
      });
    } catch (err: any) {
      if (err instanceof ZodError) {
        res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para adicionar jogo à biblioteca.',
          errors: err.flatten().fieldErrors,
        });
        return;
      }

      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({
        status: 'error',
        code: err.code || 'LIBRARY_ADD_ERROR',
        message: err.message || 'Erro ao adicionar jogo à biblioteca.',
        ...(err.existingEntryId ? { existingEntryId: err.existingEntryId } : {}),
      });
    }
  };

  list = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user?.id) {
        res.status(401).json({
          status: 'error',
          code: 'UNAUTHORIZED',
          message: 'Usuário não autenticado.',
        });
        return;
      }

      const query = libraryQuerySchema.parse(req.query);
      const result = await this.service.listGames(req.user.id, query);
      res.status(200).json(result);
    } catch (err: any) {
      if (err instanceof ZodError) {
        res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros de consulta inválidos.',
          errors: err.flatten().fieldErrors,
        });
        return;
      }

      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({
        status: 'error',
        code: err.code || 'LIBRARY_LIST_ERROR',
        message: err.message || 'Erro ao consultar biblioteca pessoal.',
      });
    }
  };

  getStats = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user?.id) {
        res.status(401).json({
          status: 'error',
          code: 'UNAUTHORIZED',
          message: 'Usuário não autenticado.',
        });
        return;
      }

      const stats = await this.service.getStats(req.user.id);
      res.status(200).json({
        status: 'success',
        data: stats,
      });
    } catch (err: any) {
      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({
        status: 'error',
        code: err.code || 'LIBRARY_STATS_ERROR',
        message: err.message || 'Erro ao calcular estatísticas da biblioteca.',
      });
    }
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user?.id) {
        res.status(401).json({
          status: 'error',
          code: 'UNAUTHORIZED',
          message: 'Usuário não autenticado.',
        });
        return;
      }

      const { id } = libraryEntryIdParamSchema.parse(req.params);
      const entry = await this.service.getEntryById(req.user.id, id);

      res.status(200).json({
        status: 'success',
        data: entry,
      });
    } catch (err: any) {
      if (err instanceof ZodError) {
        res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          message: 'Identificador inválido.',
          errors: err.flatten().fieldErrors,
        });
        return;
      }

      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({
        status: 'error',
        code: err.code || 'LIBRARY_FETCH_ERROR',
        message: err.message || 'Erro ao consultar registro da biblioteca.',
      });
    }
  };

  update = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user?.id) {
        res.status(401).json({
          status: 'error',
          code: 'UNAUTHORIZED',
          message: 'Usuário não autenticado.',
        });
        return;
      }

      const { id } = libraryEntryIdParamSchema.parse(req.params);
      const validated = updateLibraryGameSchema.parse(req.body);
      const updated = await this.service.updateEntry(req.user.id, id, validated);

      res.status(200).json({
        status: 'success',
        message: 'Registro da biblioteca atualizado com sucesso.',
        data: updated,
      });
    } catch (err: any) {
      if (err instanceof ZodError) {
        res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para atualização.',
          errors: err.flatten().fieldErrors,
        });
        return;
      }

      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({
        status: 'error',
        code: err.code || 'LIBRARY_UPDATE_ERROR',
        message: err.message || 'Erro ao atualizar registro da biblioteca.',
      });
    }
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user?.id) {
        res.status(401).json({
          status: 'error',
          code: 'UNAUTHORIZED',
          message: 'Usuário não autenticado.',
        });
        return;
      }

      const { id } = libraryEntryIdParamSchema.parse(req.params);
      await this.service.removeEntry(req.user.id, id);

      res.status(204).send();
    } catch (err: any) {
      if (err instanceof ZodError) {
        res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          message: 'Identificador inválido.',
          errors: err.flatten().fieldErrors,
        });
        return;
      }

      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({
        status: 'error',
        code: err.code || 'LIBRARY_DELETE_ERROR',
        message: err.message || 'Erro ao remover jogo da biblioteca.',
      });
    }
  };
}
