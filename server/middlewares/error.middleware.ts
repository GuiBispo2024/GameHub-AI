import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';
import { isDev } from '../config/env';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  field?: string;
  errors?: Record<string, string[]>;
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // 1. Zod Validation Errors
  if (err instanceof ZodError) {
    const fieldErrors = err.flatten().fieldErrors;
    res.status(400).json({
      status: 'error',
      code: 'VALIDATION_ERROR',
      message: 'Dados enviados na requisição são inválidos.',
      errors: fieldErrors,
    });
    return;
  }

  // 2. Custom App/Operational Errors
  const statusCode = err.statusCode || 500;
  const isClientError = statusCode >= 400 && statusCode < 500;

  if (isClientError) {
    logger.warn(`[Client Error ${statusCode}] ${req.method} ${req.originalUrl}: ${err.message}`);
    res.status(statusCode).json({
      status: 'error',
      code: err.code || 'BAD_REQUEST',
      message: err.message || 'Requisição inválida.',
      field: err.field,
    });
    return;
  }

  // 3. Unhandled Internal Server Errors (500)
  logger.error(`[Unhandled Error] ${req.method} ${req.originalUrl}:`, err);

  res.status(500).json({
    status: 'error',
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Ocorreu um erro interno no servidor ao processar a solicitação.',
    error: isDev ? err.message : undefined,
  });
}
