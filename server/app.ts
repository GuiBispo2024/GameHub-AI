import express, { Express, Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import { apiRouter } from './routes/api.routes';
import { healthRouter } from './routes/health.routes';
import { errorHandler } from './middlewares/error.middleware';

export function createApp(): Express {
  const app = express();

  // JSON and URL-encoded body parsers
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Cookie parser for secure HttpOnly session tokens
  app.use(cookieParser());

  // CORS and Headers for browser app, desktop overlay, and credentialed requests
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-GameHub-Client, X-GameHub-Overlay'
    );

    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Explicit health check routes mounted BEFORE Vite middlewares / SPA fallbacks
  // Ensures both /health and /api/health strictly return JSON
  app.use('/health', healthRouter);
  app.use('/api/health', healthRouter);

  // Mount backend API routes
  app.use('/api', apiRouter);

  // Centralized standardized error handling middleware
  app.use(errorHandler);

  return app;
}
