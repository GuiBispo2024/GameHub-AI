import { NextFunction, Request, Response } from 'express';
import {
  createKnowledgeGuideSchema,
  guideIdParamSchema,
  listKnowledgeGuidesQuerySchema,
  rechunkGuideSchema,
  updateKnowledgeGuideSchema,
} from './knowledge.schema';
import { knowledgeService } from './knowledge.service';

export class KnowledgeController {
  static async createGuide(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const input = createKnowledgeGuideSchema.parse(req.body);
      const guide = await knowledgeService.createGuide(userId, input);
      res.status(201).json({
        status: 'success',
        message: 'Documento de conhecimento cadastrado e processado com sucesso.',
        data: guide,
      });
    } catch (err) {
      next(err);
    }
  }

  static async listGuides(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listKnowledgeGuidesQuerySchema.parse(req.query);
      const result = await knowledgeService.listGuides(query);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getGuide(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = guideIdParamSchema.parse(req.params);
      const guide = await knowledgeService.getGuideById(id);
      res.status(200).json({
        status: 'success',
        data: guide,
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateGuide(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = guideIdParamSchema.parse(req.params);
      const input = updateKnowledgeGuideSchema.parse(req.body);
      const updated = await knowledgeService.updateGuide(id, input);
      res.status(200).json({
        status: 'success',
        message: 'Documento de conhecimento atualizado com sucesso.',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  static async rechunkGuide(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = guideIdParamSchema.parse(req.params);
      const input = rechunkGuideSchema.parse(req.body);
      const updated = await knowledgeService.rechunkGuide(id, input);
      res.status(200).json({
        status: 'success',
        message: 'Trechos do documento reprocessados com sucesso.',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  static async deleteGuide(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = guideIdParamSchema.parse(req.params);
      await knowledgeService.deleteGuide(id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
}
