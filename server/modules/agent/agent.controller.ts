import { NextFunction, Request, Response } from 'express';
import {
  actionIdParamSchema,
  chatRequestSchema,
  conversationIdParamSchema,
  listConversationsQuerySchema,
} from './agent.schema';
import { gameAgent } from './agent.service';

export class AgentController {
  static async chat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const input = chatRequestSchema.parse(req.body);
      const result = await gameAgent.chat(userId, input);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async listConversations(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.id;
      const query = listConversationsQuerySchema.parse(req.query);
      const result = await gameAgent.listConversations(userId, query);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getConversation(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = conversationIdParamSchema.parse(req.params);
      const conversation = await gameAgent.getConversationById(userId, id);
      res.status(200).json({
        status: 'success',
        data: conversation,
      });
    } catch (err) {
      next(err);
    }
  }

  static async deleteConversation(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = conversationIdParamSchema.parse(req.params);
      await gameAgent.deleteConversation(userId, id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  static async confirmAction(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = actionIdParamSchema.parse(req.params);
      const result = await gameAgent.confirmActionProposal(userId, id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async cancelAction(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.id;
      const { id } = actionIdParamSchema.parse(req.params);
      const result = await gameAgent.cancelActionProposal(userId, id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}
