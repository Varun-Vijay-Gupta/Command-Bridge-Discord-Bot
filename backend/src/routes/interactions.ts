import { Router, Request, Response } from 'express';
import {
  DiscordInteraction,
  InteractionType,
  verifyDiscordSignature,
  buildPongResponse,
} from '../utils/discord';
import { processInteraction } from '../services/interaction.service';
import { logger } from '../config/logger';
import { asyncHandler } from '../middleware/validate';

export const interactionsRouter = Router();

interactionsRouter.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const signature = req.headers['x-signature-ed25519'] as string;
    const timestamp = req.headers['x-signature-timestamp'] as string;
    const rawBody = (req as Request & { rawBody?: string }).rawBody;

    logger.info('Discord interaction received', {
      hasSignature: Boolean(signature),
      hasTimestamp: Boolean(timestamp),
      hasRawBody: Boolean(rawBody),
    });

    if (!signature || !timestamp || !rawBody) {
      res.status(401).json({ error: 'Missing signature headers' });
      return;
    }

    if (!verifyDiscordSignature(rawBody, signature, timestamp)) {
      logger.warn('Invalid Discord signature');
      res.status(401).json({ error: 'Invalid request signature' });
      return;
    }

    const interaction = req.body as DiscordInteraction;

    if (interaction.type === InteractionType.PING) {
      logger.info('Received PING, responding with PONG');
      res.json(buildPongResponse());
      return;
    }

    logger.info('Processing interaction', {
      type: interaction.type,
      command: interaction.data?.name,
      interactionId: interaction.id,
    });

    const response = await processInteraction(interaction);
    res.json(response);
  })
);
