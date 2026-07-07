import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { validateBody, asyncHandler, param } from '../middleware/validate';

export const commandsRouter = Router();
commandsRouter.use(authMiddleware);

const updateRuleSchema = z.object({
  enabled: z.boolean().optional(),
  responseTemplate: z.string().nullable().optional(),
  mirrorEnabled: z.boolean().optional(),
  autoTagEnabled: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
});

commandsRouter.get(
  '/:serverId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const serverId = param(req, 'serverId');
    const server = await prisma.discordServer.findFirst({
      where: { id: serverId, adminId: req.admin!.id },
    });

    if (!server) {
      res.status(404).json({ error: 'Server not found' });
      return;
    }

    const rules = await prisma.commandRule.findMany({
      where: { serverId: server.id },
      orderBy: { commandName: 'asc' },
    });

    res.json(rules);
  })
);

commandsRouter.patch(
  '/:serverId/:commandName',
  validateBody(updateRuleSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const serverId = param(req, 'serverId');
    const commandName = param(req, 'commandName');
    const server = await prisma.discordServer.findFirst({
      where: { id: serverId, adminId: req.admin!.id },
    });

    if (!server) {
      res.status(404).json({ error: 'Server not found' });
      return;
    }

    const rule = await prisma.commandRule.update({
      where: {
        serverId_commandName: {
          serverId: server.id,
          commandName,
        },
      },
      data: req.body,
    });

    res.json(rule);
  })
);

commandsRouter.post(
  '/:serverId',
  validateBody(
    z.object({
      commandName: z.string().min(1),
      enabled: z.boolean().default(true),
      mirrorEnabled: z.boolean().default(true),
      autoTagEnabled: z.boolean().default(false),
      responseTemplate: z.string().optional(),
    })
  ),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const serverId = param(req, 'serverId');
    const server = await prisma.discordServer.findFirst({
      where: { id: serverId, adminId: req.admin!.id },
    });

    if (!server) {
      res.status(404).json({ error: 'Server not found' });
      return;
    }

    const rule = await prisma.commandRule.create({
      data: {
        serverId: server.id,
        ...req.body,
      },
    });

    res.status(201).json(rule);
  })
);
