import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { validateBody, asyncHandler, param } from '../middleware/validate';
import { env } from '../config/env';

export const serversRouter = Router();
serversRouter.use(authMiddleware);

const connectServerSchema = z.object({
  guildId: z.string().min(1),
  guildName: z.string().min(1),
  ownerId: z.string().optional(),
  botChannelId: z.string().optional(),
});

const updateServerSchema = z.object({
  guildName: z.string().min(1).optional(),
  botChannelId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

serversRouter.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const servers = await prisma.discordServer.findMany({
      where: { adminId: req.admin!.id },
      include: {
        commandRules: true,
        _count: { select: { interactionLogs: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(servers);
  })
);

serversRouter.post(
  '/',
  validateBody(connectServerSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = req.body as z.infer<typeof connectServerSchema>;

    const server = await prisma.discordServer.upsert({
      where: { guildId: data.guildId },
      update: {
        guildName: data.guildName,
        ownerId: data.ownerId,
        botChannelId: data.botChannelId,
        adminId: req.admin!.id,
      },
      create: {
        guildId: data.guildId,
        guildName: data.guildName,
        ownerId: data.ownerId,
        botChannelId: data.botChannelId,
        adminId: req.admin!.id,
      },
    });

    const defaultCommands = ['report', 'status'];
    for (const commandName of defaultCommands) {
      await prisma.commandRule.upsert({
        where: { serverId_commandName: { serverId: server.id, commandName } },
        update: {},
        create: {
          serverId: server.id,
          commandName,
          enabled: true,
          mirrorEnabled: true,
          autoTagEnabled: false,
        },
      });
    }

    const full = await prisma.discordServer.findUnique({
      where: { id: server.id },
      include: { commandRules: true },
    });

    res.status(201).json(full);
  })
);

serversRouter.patch(
  '/:id',
  validateBody(updateServerSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = param(req, 'id');
    const server = await prisma.discordServer.findFirst({
      where: { id, adminId: req.admin!.id },
    });

    if (!server) {
      res.status(404).json({ error: 'Server not found' });
      return;
    }

    const updated = await prisma.discordServer.update({
      where: { id: server.id },
      data: req.body,
      include: { commandRules: true },
    });

    res.json(updated);
  })
);

serversRouter.delete(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = param(req, 'id');
    const server = await prisma.discordServer.findFirst({
      where: { id, adminId: req.admin!.id },
    });

    if (!server) {
      res.status(404).json({ error: 'Server not found' });
      return;
    }

    await prisma.discordServer.delete({ where: { id: server.id } });
    res.status(204).send();
  })
);

serversRouter.get(
  '/invite-url',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const clientId = env.DISCORD_CLIENT_ID || env.DISCORD_APPLICATION_ID;
    const permissions = '2147483648';
    const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${permissions}&scope=bot%20applications.commands`;
    res.json({ url });
  })
);
