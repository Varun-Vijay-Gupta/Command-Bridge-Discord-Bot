import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { validateBody, asyncHandler } from '../middleware/validate';
import { addSseClient, getConnectedClients } from '../services/sse.service';

export const settingsRouter = Router();

const updateSettingsSchema = z.object({
  mirrorWebhookUrl: z.string().url().nullable().optional(),
  mirrorWebhookType: z.enum(['slack', 'discord']).optional(),
  aiProvider: z.enum(['groq', 'gemini', 'none']).optional(),
});

settingsRouter.get(
  '/events',
  authMiddleware,
  (req: AuthRequest, res: Response) => {
    addSseClient(res);
  }
);

settingsRouter.get(
  '/',
  authMiddleware,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const settings = await prisma.appSettings.findUnique({ where: { id: 'default' } });

    res.json({
      mirrorWebhookUrl: settings?.mirrorWebhookUrl ? '***configured***' : null,
      mirrorWebhookType: settings?.mirrorWebhookType || env.MIRROR_WEBHOOK_TYPE,
      aiProvider: settings?.aiProvider || env.AI_PROVIDER,
      discordApplicationId: env.DISCORD_APPLICATION_ID,
      frontendUrl: env.FRONTEND_URL,
      sseClients: getConnectedClients(),
    });
  })
);

settingsRouter.patch(
  '/',
  authMiddleware,
  validateBody(updateSettingsSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const settings = await prisma.appSettings.upsert({
      where: { id: 'default' },
      update: req.body,
      create: { id: 'default', ...req.body },
    });

    res.json({
      mirrorWebhookUrl: settings.mirrorWebhookUrl ? '***configured***' : null,
      mirrorWebhookType: settings.mirrorWebhookType,
      aiProvider: settings.aiProvider,
    });
  })
);

settingsRouter.get(
  '/health',
  asyncHandler(async (_req, res: Response) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    } catch {
      res.status(503).json({ status: 'unhealthy', timestamp: new Date().toISOString() });
    }
  })
);
