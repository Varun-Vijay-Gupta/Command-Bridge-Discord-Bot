import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { interactionsRouter } from './routes/interactions';
import { authRouter } from './routes/auth';
import { serversRouter } from './routes/servers';
import { commandsRouter } from './routes/commands';
import { logsRouter } from './routes/logs';
import { settingsRouter } from './routes/settings';

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
    })
  );

  app.use(
    '/api/interactions',
    express.raw({ type: 'application/json' }),
    (req: Request, _res: Response, next) => {
      const raw = req.body as Buffer;
      (req as Request & { rawBody?: string }).rawBody = raw.toString('utf8');
      try {
        req.body = JSON.parse((req as Request & { rawBody?: string }).rawBody!);
      } catch {
        req.body = {};
      }
      next();
    },
    interactionsRouter
  );

  app.use(express.json());

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use('/api', apiLimiter);

  app.use('/api/auth', authRouter);
  app.use('/api/servers', serversRouter);
  app.use('/api/commands', commandsRouter);
  app.use('/api/logs', logsRouter);
  app.use('/api/settings', settingsRouter);

  app.get('/', (_req, res) => {
    res.json({
      name: 'CommandBridge API',
      version: '1.0.0',
      docs: '/api/settings/health',
    });
  });

  app.use(errorHandler);

  return app;
}
