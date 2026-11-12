import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { JourneysService, journeysService } from './journeys.service';
import {
  createGameBuildSchema,
  createJourneySchema,
  createProgressLogSchema,
  listJourneysQuerySchema,
  updateGameBuildSchema,
  updateJourneySchema,
  updateProgressLogSchema,
  uuidParamSchema,
} from './journeys.schema';

export class JourneysController {
  private service: JourneysService;

  constructor(service?: JourneysService) {
    this.service = service || journeysService;
  }

  private handleError(res: Response, err: any, fallbackCode: string, fallbackMessage: string) {
    if (err instanceof ZodError) {
      res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos na requisição.',
        errors: err.flatten().fieldErrors,
      });
      return;
    }

    const statusCode = err?.statusCode || 500;
    res.status(statusCode).json({
      status: 'error',
      code: err?.code || fallbackCode,
      message: err?.message || fallbackMessage,
    });
  }

  // ---------------------------------------------------------------------------
  // JOURNEYS
  // ---------------------------------------------------------------------------

  createJourney = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user?.id) {
        res.status(401).json({ status: 'error', code: 'UNAUTHORIZED', message: 'Usuário não autenticado.' });
        return;
      }

      const input = createJourneySchema.parse(req.body);
      const journey = await this.service.createJourney(req.user.id, input);

      res.status(201).json({
        status: 'success',
        message: 'Jornada de gameplay criada com sucesso.',
        data: journey,
      });
    } catch (err) {
      this.handleError(res, err, 'JOURNEY_CREATE_ERROR', 'Erro ao criar jornada de gameplay.');
    }
  };

  listJourneys = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user?.id) {
        res.status(401).json({ status: 'error', code: 'UNAUTHORIZED', message: 'Usuário não autenticado.' });
        return;
      }

      const query = listJourneysQuerySchema.parse(req.query);
      const result = await this.service.listJourneys(req.user.id, query);
      res.status(200).json(result);
    } catch (err) {
      this.handleError(res, err, 'JOURNEY_LIST_ERROR', 'Erro ao listar jornadas de gameplay.');
    }
  };

  getJourneyById = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user?.id) {
        res.status(401).json({ status: 'error', code: 'UNAUTHORIZED', message: 'Usuário não autenticado.' });
        return;
      }

      const { id } = uuidParamSchema.parse(req.params);
      const journey = await this.service.getJourneyById(req.user.id, id);

      res.status(200).json({
        status: 'success',
        data: journey,
      });
    } catch (err) {
      this.handleError(res, err, 'JOURNEY_FETCH_ERROR', 'Erro ao consultar jornada de gameplay.');
    }
  };

  updateJourney = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user?.id) {
        res.status(401).json({ status: 'error', code: 'UNAUTHORIZED', message: 'Usuário não autenticado.' });
        return;
      }

      const { id } = uuidParamSchema.parse(req.params);
      const input = updateJourneySchema.parse(req.body);
      const updated = await this.service.updateJourney(req.user.id, id, input);

      res.status(200).json({
        status: 'success',
        message: 'Jornada atualizada com sucesso.',
        data: updated,
      });
    } catch (err) {
      this.handleError(res, err, 'JOURNEY_UPDATE_ERROR', 'Erro ao atualizar jornada de gameplay.');
    }
  };

  activateJourney = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user?.id) {
        res.status(401).json({ status: 'error', code: 'UNAUTHORIZED', message: 'Usuário não autenticado.' });
        return;
      }

      const { id } = uuidParamSchema.parse(req.params);
      const activated = await this.service.activateJourney(req.user.id, id);

      res.status(200).json({
        status: 'success',
        message: 'Jornada definida como ativa com sucesso.',
        data: activated,
      });
    } catch (err) {
      this.handleError(res, err, 'JOURNEY_ACTIVATE_ERROR', 'Erro ao ativar jornada de gameplay.');
    }
  };

  deleteJourney = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user?.id) {
        res.status(401).json({ status: 'error', code: 'UNAUTHORIZED', message: 'Usuário não autenticado.' });
        return;
      }

      const { id } = uuidParamSchema.parse(req.params);
      await this.service.deleteJourney(req.user.id, id);
      res.status(204).send();
    } catch (err) {
      this.handleError(res, err, 'JOURNEY_DELETE_ERROR', 'Erro ao excluir jornada de gameplay.');
    }
  };

  // ---------------------------------------------------------------------------
  // PROGRESS LOGS
  // ---------------------------------------------------------------------------

  listProgress = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user?.id) {
        res.status(401).json({ status: 'error', code: 'UNAUTHORIZED', message: 'Usuário não autenticado.' });
        return;
      }

      const { id } = uuidParamSchema.parse(req.params);
      const logs = await this.service.listProgress(req.user.id, id);

      res.status(200).json({
        status: 'success',
        data: logs,
      });
    } catch (err) {
      this.handleError(res, err, 'PROGRESS_LIST_ERROR', 'Erro ao listar histórico de progresso.');
    }
  };

  createProgress = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user?.id) {
        res.status(401).json({ status: 'error', code: 'UNAUTHORIZED', message: 'Usuário não autenticado.' });
        return;
      }

      const { id } = uuidParamSchema.parse(req.params);
      const input = createProgressLogSchema.parse(req.body);
      const log = await this.service.createProgress(req.user.id, id, input);

      res.status(201).json({
        status: 'success',
        message: 'Progresso registrado com sucesso.',
        data: log,
      });
    } catch (err) {
      this.handleError(res, err, 'PROGRESS_CREATE_ERROR', 'Erro ao registrar progresso.');
    }
  };

  updateProgress = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user?.id) {
        res.status(401).json({ status: 'error', code: 'UNAUTHORIZED', message: 'Usuário não autenticado.' });
        return;
      }

      const { id } = uuidParamSchema.parse(req.params);
      const input = updateProgressLogSchema.parse(req.body);
      const updated = await this.service.updateProgress(req.user.id, id, input);

      res.status(200).json({
        status: 'success',
        message: 'Registro de progresso atualizado com sucesso.',
        data: updated,
      });
    } catch (err) {
      this.handleError(res, err, 'PROGRESS_UPDATE_ERROR', 'Erro ao atualizar registro de progresso.');
    }
  };

  deleteProgress = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user?.id) {
        res.status(401).json({ status: 'error', code: 'UNAUTHORIZED', message: 'Usuário não autenticado.' });
        return;
      }

      const { id } = uuidParamSchema.parse(req.params);
      await this.service.deleteProgress(req.user.id, id);
      res.status(204).send();
    } catch (err) {
      this.handleError(res, err, 'PROGRESS_DELETE_ERROR', 'Erro ao excluir registro de progresso.');
    }
  };

  // ---------------------------------------------------------------------------
  // GAME BUILDS
  // ---------------------------------------------------------------------------

  listBuilds = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user?.id) {
        res.status(401).json({ status: 'error', code: 'UNAUTHORIZED', message: 'Usuário não autenticado.' });
        return;
      }

      const { id } = uuidParamSchema.parse(req.params);
      const builds = await this.service.listBuilds(req.user.id, id);

      res.status(200).json({
        status: 'success',
        data: builds,
      });
    } catch (err) {
      this.handleError(res, err, 'BUILDS_LIST_ERROR', 'Erro ao listar builds da jornada.');
    }
  };

  createBuild = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user?.id) {
        res.status(401).json({ status: 'error', code: 'UNAUTHORIZED', message: 'Usuário não autenticado.' });
        return;
      }

      const { id } = uuidParamSchema.parse(req.params);
      const input = createGameBuildSchema.parse(req.body);
      const build = await this.service.createBuild(req.user.id, id, input);

      res.status(201).json({
        status: 'success',
        message: 'Build criada com sucesso.',
        data: build,
      });
    } catch (err) {
      this.handleError(res, err, 'BUILD_CREATE_ERROR', 'Erro ao criar build.');
    }
  };

  getBuildById = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user?.id) {
        res.status(401).json({ status: 'error', code: 'UNAUTHORIZED', message: 'Usuário não autenticado.' });
        return;
      }

      const { id } = uuidParamSchema.parse(req.params);
      const build = await this.service.getBuildById(req.user.id, id);

      res.status(200).json({
        status: 'success',
        data: build,
      });
    } catch (err) {
      this.handleError(res, err, 'BUILD_FETCH_ERROR', 'Erro ao consultar detalhes da build.');
    }
  };

  updateBuild = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user?.id) {
        res.status(401).json({ status: 'error', code: 'UNAUTHORIZED', message: 'Usuário não autenticado.' });
        return;
      }

      const { id } = uuidParamSchema.parse(req.params);
      const input = updateGameBuildSchema.parse(req.body);
      const updated = await this.service.updateBuild(req.user.id, id, input);

      res.status(200).json({
        status: 'success',
        message: 'Build atualizada com sucesso.',
        data: updated,
      });
    } catch (err) {
      this.handleError(res, err, 'BUILD_UPDATE_ERROR', 'Erro ao atualizar build.');
    }
  };

  deleteBuild = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user?.id) {
        res.status(401).json({ status: 'error', code: 'UNAUTHORIZED', message: 'Usuário não autenticado.' });
        return;
      }

      const { id } = uuidParamSchema.parse(req.params);
      await this.service.deleteBuild(req.user.id, id);
      res.status(204).send();
    } catch (err) {
      this.handleError(res, err, 'BUILD_DELETE_ERROR', 'Erro ao excluir build.');
    }
  };
}
