import { Router, Request, Response } from 'express';
import { checkDatabaseConnection } from '../db/prisma';
import { ENV } from '../config/env';

export const healthRouter = Router();

healthRouter.get('/', async (_req: Request, res: Response) => {
  const dbStatus = await checkDatabaseConnection();

  const healthData = {
    status: 'ok',
    app: 'GameHub AI API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: ENV.NODE_ENV,
    database: {
      status: dbStatus.status,
      engine: dbStatus.engine,
      provider: dbStatus.provider,
      connected: dbStatus.connected,
      message: dbStatus.message,
    },
    modules: {
      auth: 'ACTIVE',
      users: 'ACTIVE',
      library: 'ACTIVE',
      journeys: 'ACTIVE',
      knowledge: 'ACTIVE',
      companion: 'ACTIVE',
      agent: 'ACTIVE',
    },
  };

  res.setHeader('Content-Type', 'application/json');
  res.json(healthData);
});
