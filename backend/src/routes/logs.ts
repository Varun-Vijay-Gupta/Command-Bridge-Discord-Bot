import { Router, Response } from 'express';
import { InteractionStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { asyncHandler, param } from '../middleware/validate';
import { retryFailedInteraction } from '../services/interaction.service';

export const logsRouter = Router();
logsRouter.use(authMiddleware);

logsRouter.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const status = req.query.status as InteractionStatus | undefined;
    const serverId = req.query.serverId as string | undefined;
    const commandName = req.query.commandName as string | undefined;

    const servers = await prisma.discordServer.findMany({
      where: { adminId: req.admin!.id },
      select: { id: true },
    });
    const serverIds = servers.map((s: { id: string }) => s.id);

    const where = {
      serverId: serverId ? serverId : { in: serverIds },
      ...(status && { status }),
      ...(commandName && { commandName }),
    };

    const [logs, total] = await Promise.all([
      prisma.interactionLog.findMany({
        where,
        include: {
          server: { select: { guildName: true, guildId: true } },
          failures: { orderBy: { createdAt: 'desc' }, take: 5 },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.interactionLog.count({ where }),
    ]);

    res.json({
      logs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  })
);

logsRouter.get(
  '/stats',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const servers = await prisma.discordServer.findMany({
      where: { adminId: req.admin!.id },
      select: { id: true },
    });
    const serverIds = servers.map((s: { id: string }) => s.id);

    const [total, completed, failed, deferred, recentLogs] = await Promise.all([
      prisma.interactionLog.count({ where: { serverId: { in: serverIds } } }),
      prisma.interactionLog.count({
        where: { serverId: { in: serverIds }, status: InteractionStatus.COMPLETED },
      }),
      prisma.interactionLog.count({
        where: { serverId: { in: serverIds }, status: InteractionStatus.FAILED },
      }),
      prisma.interactionLog.count({
        where: { serverId: { in: serverIds }, status: InteractionStatus.DEFERRED },
      }),
      prisma.interactionLog.findMany({
        where: { serverId: { in: serverIds } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          commandName: true,
          userName: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    res.json({ total, completed, failed, deferred, recentLogs });
  })
);

logsRouter.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const logId = param(req, 'id');
    const log = await prisma.interactionLog.findUnique({
      where: { id: logId },
      include: {
        server: true,
        failures: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!log) {
      res.status(404).json({ error: 'Log not found' });
      return;
    }

    if (log.serverId) {
      const server = await prisma.discordServer.findFirst({
        where: { id: log.serverId, adminId: req.admin!.id },
      });
      if (!server) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }
    }

    res.json(log);
  })
);

logsRouter.post(
  '/:id/retry',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const logId = param(req, 'id');
    const log = await prisma.interactionLog.findUnique({
      where: { id: logId },
      include: { server: true },
    });

    if (!log) {
      res.status(404).json({ error: 'Log not found' });
      return;
    }

    if (log.serverId) {
      const owned = await prisma.discordServer.findFirst({
        where: { id: log.serverId, adminId: req.admin!.id },
      });
      if (!owned) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }
    }

    await retryFailedInteraction(log.id);
    const updated = await prisma.interactionLog.findUnique({
      where: { id: log.id },
      include: { failures: true },
    });

    res.json(updated);
  })
);

logsRouter.get(
  '/failures/history',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);

    const servers = await prisma.discordServer.findMany({
      where: { adminId: req.admin!.id },
      select: { id: true },
    });

    const failures = await prisma.failureLog.findMany({
      where: {
        interactionLog: { serverId: { in: servers.map((s: { id: string }) => s.id) } },
      },
      include: {
        interactionLog: {
          select: {
            id: true,
            interactionId: true,
            commandName: true,
            userName: true,
            server: { select: { guildName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    res.json({ failures, page, limit });
  })
);
