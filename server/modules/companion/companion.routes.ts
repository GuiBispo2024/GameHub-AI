import { Router, Request, Response } from 'express';

export const companionRouter = Router();

// Placeholder routes for Game Companion with Gemini
companionRouter.get('/sessions', (_req: Request, res: Response) => {
  res.status(501).json({
    status: 'NOT_IMPLEMENTED',
    module: 'Game Companion (Gemini AI)',
    message: 'O agente inteligente Game Companion com Gemini API será implementado na etapa de Companion.',
  });
});
