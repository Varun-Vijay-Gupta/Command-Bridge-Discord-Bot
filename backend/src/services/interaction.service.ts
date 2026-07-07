import { InteractionStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';
import {
  DiscordInteraction,
  InteractionResponse,
  InteractionType,
  buildMessageResponse,
  buildDeferredResponse,
  buildEmbedResponse,
  buildModalResponse,
  editOriginalResponse,
  getInteractionUser,
  MessageComponentType,
  ButtonStyle,
} from '../utils/discord';
import { mirrorInteraction } from './mirror.service';
import { summarizeInteraction } from './ai.service';
import { broadcastInteraction } from './sse.service';

export async function processInteraction(
  interaction: DiscordInteraction
): Promise<InteractionResponse> {
  // Slash commands must ack within 3s — defer immediately, finish in background.
  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    void handleSlashCommandAsync(interaction);
    return buildDeferredResponse(false);
  }

  const startTime = Date.now();
  const user = getInteractionUser(interaction);

  const existing = await prisma.interactionLog.findUnique({
    where: { interactionId: interaction.id },
  });

  if (existing) {
    logger.info('Duplicate interaction detected', { interactionId: interaction.id });
    return buildMessageResponse('This interaction was already processed.', true);
  }

  const server = interaction.guild_id
    ? await prisma.discordServer.findUnique({ where: { guildId: interaction.guild_id } })
    : null;

  const log = await prisma.interactionLog.create({
    data: {
      interactionId: interaction.id,
      serverId: server?.id,
      commandName: interaction.data?.name,
      userId: user.id,
      userName: user.username,
      channelId: interaction.channel_id,
      status: InteractionStatus.RECEIVED,
      requestPayload: interaction as object,
    },
  });

  broadcastInteraction(log);

  try {
    await prisma.interactionLog.update({
      where: { id: log.id },
      data: { status: InteractionStatus.PROCESSING },
    });

    if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
      return await handleButtonClick(interaction, log.id, startTime);
    }

    if (interaction.type === InteractionType.MODAL_SUBMIT) {
      return await handleModalSubmit(interaction, log.id, startTime);
    }

    return buildMessageResponse('Unsupported interaction type.', true);
  } catch (error) {
    const err = error as Error;
    logger.error('Interaction processing failed', { interactionId: interaction.id, error: err });

    await recordFailure(log.id, 1, err);
    await prisma.interactionLog.update({
      where: { id: log.id },
      data: {
        status: InteractionStatus.FAILED,
        errorMessage: err.message,
        processingMs: Date.now() - startTime,
      },
    });

    const updatedLog = await prisma.interactionLog.findUnique({ where: { id: log.id } });
    if (updatedLog) broadcastInteraction(updatedLog);

    return buildMessageResponse('An error occurred while processing your command.', true);
  }
}

async function handleSlashCommandAsync(interaction: DiscordInteraction): Promise<void> {
  const startTime = Date.now();
  const user = getInteractionUser(interaction);
  const commandName = interaction.data?.name;

  const respondWithError = async (message: string) => {
    try {
      await editOriginalResponse(
        interaction.token,
        { content: message },
        interaction.application_id
      );
    } catch (editError) {
      logger.error('Failed to send deferred error response', { editError, interactionId: interaction.id });
    }
  };

  try {
    const existing = await prisma.interactionLog.findUnique({
      where: { interactionId: interaction.id },
    });

    if (existing) {
      logger.info('Duplicate interaction detected', { interactionId: interaction.id });
      await respondWithError('This interaction was already processed.');
      return;
    }

    const server = interaction.guild_id
      ? await prisma.discordServer.findUnique({ where: { guildId: interaction.guild_id } })
      : null;

    const log = await prisma.interactionLog.create({
      data: {
        interactionId: interaction.id,
        serverId: server?.id,
        commandName,
        userId: user.id,
        userName: user.username,
        channelId: interaction.channel_id,
        status: InteractionStatus.DEFERRED,
        requestPayload: interaction as object,
      },
    });

    broadcastInteraction(log);

    if (!commandName) {
      await respondWithError('Unknown command.');
      return;
    }

    if (server) {
      const rule = await prisma.commandRule.findUnique({
        where: { serverId_commandName: { serverId: server.id, commandName } },
      });
      if (rule && !rule.enabled) {
        await completeLog(log.id, { content: 'Command disabled' }, startTime);
        await respondWithError('This command is currently disabled.');
        return;
      }
    }

    const options = parseOptions(interaction);

    if (commandName === 'report') {
      await new Promise((resolve) => setTimeout(resolve, 3500));
    }

    const response = await executeCommand(commandName, options, user, server);
    await editOriginalResponse(
      interaction.token,
      {
        content: response.data?.content,
        embeds: response.data?.embeds,
        components: response.data?.components,
      },
      interaction.application_id
    );
    await completeLog(log.id, response.data, startTime, commandName, options, user, server);
  } catch (error) {
    const err = error as Error;
    logger.error('Deferred slash command failed', { interactionId: interaction.id, error: err });
    await respondWithError('An error occurred while processing your command.');
  }
}

async function handleButtonClick(
  interaction: DiscordInteraction,
  logId: string,
  startTime: number
): Promise<InteractionResponse> {
  const customId = interaction.data?.custom_id || '';

  if (customId === 'status_refresh') {
    const embed = buildStatusEmbed();
    await completeLog(logId, { embeds: [embed] }, startTime);
    return buildEmbedResponse(embed);
  }

  if (customId === 'report_open_modal') {
    return buildModalResponse('report_modal', 'Submit Report', [
      {
        type: MessageComponentType.ACTION_ROW,
        components: [
          {
            type: 4,
            custom_id: 'report_title',
            label: 'Title',
            style: 1,
            min_length: 3,
            max_length: 100,
            required: true,
          },
        ],
      },
      {
        type: MessageComponentType.ACTION_ROW,
        components: [
          {
            type: 4,
            custom_id: 'report_description',
            label: 'Description',
            style: 2,
            min_length: 10,
            max_length: 1000,
            required: true,
          },
        ],
      },
    ]);
  }

  if (customId.startsWith('ack_report_')) {
    const reportId = customId.replace('ack_report_', '');
    await completeLog(logId, { content: `Report ${reportId} acknowledged` }, startTime);
    return buildMessageResponse(`Report **${reportId}** has been acknowledged.`, false);
  }

  return buildMessageResponse('Unknown button action.', true);
}

async function handleModalSubmit(
  interaction: DiscordInteraction,
  logId: string,
  startTime: number
): Promise<InteractionResponse> {
  if (interaction.data?.custom_id === 'report_modal') {
    const components = interaction.data.components as Array<{
      components: Array<{ custom_id: string; value: string }>;
    }> | undefined;

    let title = 'Untitled';
    let description = 'No description';

    for (const row of components || []) {
      for (const comp of row.components) {
        if (comp.custom_id === 'report_title') title = comp.value;
        if (comp.custom_id === 'report_description') description = comp.value;
      }
    }

    const reportId = `RPT-${Date.now().toString(36).toUpperCase()}`;
    const embed = {
      title: `Report: ${title}`,
      description,
      color: 0xfee75c,
      fields: [
        { name: 'Report ID', value: reportId, inline: true },
        { name: 'Submitted by', value: getInteractionUser(interaction).username, inline: true },
      ],
      footer: { text: 'CommandBridge Report System' },
      timestamp: new Date().toISOString(),
    };

    await completeLog(logId, { embeds: [embed] }, startTime, 'report', { title, description });
    return buildEmbedResponse(embed, false, [
      {
        type: MessageComponentType.ACTION_ROW,
        components: [
          {
            type: MessageComponentType.BUTTON,
            style: ButtonStyle.SUCCESS,
            label: 'Acknowledge',
            custom_id: `ack_report_${reportId}`,
          },
        ],
      },
    ]);
  }

  return buildMessageResponse('Unknown modal submission.', true);
}

async function executeCommand(
  commandName: string,
  options: Record<string, unknown>,
  user: { id: string; username: string },
  server: { id: string; guildName: string; botChannelId?: string | null } | null
): Promise<InteractionResponse> {
  switch (commandName) {
    case 'status':
      return buildEmbedResponse(buildStatusEmbed(server), false, [
        {
          type: MessageComponentType.ACTION_ROW,
          components: [
            {
              type: MessageComponentType.BUTTON,
              style: ButtonStyle.PRIMARY,
              label: 'Refresh',
              custom_id: 'status_refresh',
            },
          ],
        },
      ]);

    case 'report': {
      const title = (options.title as string) || 'General Report';
      const description = (options.description as string) || 'No description provided';
      const severity = (options.severity as string) || 'medium';
      const reportId = `RPT-${Date.now().toString(36).toUpperCase()}`;

      const severityColors: Record<string, number> = {
        low: 0x57f287,
        medium: 0xfee75c,
        high: 0xed4245,
        critical: 0x9b59b6,
      };

      const embed = {
        title: `Report: ${title}`,
        description,
        color: severityColors[severity] || 0xfee75c,
        fields: [
          { name: 'Report ID', value: reportId, inline: true },
          { name: 'Severity', value: severity.toUpperCase(), inline: true },
          { name: 'Reporter', value: user.username, inline: true },
          { name: 'Server', value: server?.guildName || 'DM', inline: true },
        ],
        footer: { text: 'CommandBridge Report System' },
        timestamp: new Date().toISOString(),
      };

      return buildEmbedResponse(embed, false, [
        {
          type: MessageComponentType.ACTION_ROW,
          components: [
            {
              type: MessageComponentType.BUTTON,
              style: ButtonStyle.SUCCESS,
              label: 'Acknowledge',
              custom_id: `ack_report_${reportId}`,
            },
            {
              type: MessageComponentType.BUTTON,
              style: ButtonStyle.SECONDARY,
              label: 'Open Form',
              custom_id: 'report_open_modal',
            },
          ],
        },
      ]);
    }

    default:
      return buildMessageResponse(`Unknown command: /${commandName}`, true);
  }
}

function buildStatusEmbed(server?: { guildName: string; botChannelId?: string | null } | null) {
  return {
    title: 'System Status',
    description: 'CommandBridge is operational.',
    color: 0x5865f2,
    fields: [
      { name: 'Status', value: 'Online', inline: true },
      { name: 'API Version', value: 'v10', inline: true },
      { name: 'Server', value: server?.guildName || 'Not connected', inline: true },
      { name: 'Response Channel', value: server?.botChannelId || 'Default', inline: true },
      { name: 'Uptime', value: formatUptime(process.uptime()), inline: true },
    ],
    footer: { text: 'CommandBridge Status Monitor' },
    timestamp: new Date().toISOString(),
  };
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
}

function parseOptions(interaction: DiscordInteraction): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const opt of interaction.data?.options || []) {
    if (opt.value !== undefined) {
      result[opt.name] = opt.value;
    }
    for (const sub of opt.options || []) {
      if (sub.value !== undefined) {
        result[sub.name] = sub.value;
      }
    }
  }
  return result;
}

async function completeLog(
  logId: string,
  responseData: unknown,
  startTime: number,
  commandName?: string,
  options?: Record<string, unknown>,
  user?: { id: string; username: string },
  server?: { id: string; guildName: string } | null
): Promise<void> {
  let aiSummary: string | undefined;
  let tags: string[] = [];

  const rule = server && commandName
    ? await prisma.commandRule.findUnique({
        where: { serverId_commandName: { serverId: server.id, commandName } },
      })
    : null;

  if (rule?.autoTagEnabled && commandName && options && user) {
    const aiResult = await summarizeInteraction(commandName, options, user.username);
    if (aiResult) {
      aiSummary = aiResult.summary;
      tags = aiResult.tags;
    }
  }

  const updated = await prisma.interactionLog.update({
    where: { id: logId },
    data: {
      status: InteractionStatus.COMPLETED,
      responsePayload: responseData as object,
      processingMs: Date.now() - startTime,
      aiSummary,
      tags,
    },
  });

  broadcastInteraction(updated);

  if (commandName && user) {
    const mirrorRule = server
      ? await prisma.commandRule.findUnique({
          where: { serverId_commandName: { serverId: server.id, commandName } },
        })
      : null;

    if (mirrorRule?.mirrorEnabled !== false) {
      await mirrorInteraction({
        commandName,
        userName: user.username,
        userId: user.id,
        guildName: server?.guildName,
        status: 'COMPLETED',
        summary: aiSummary,
        tags,
      });
    }
  }
}

async function recordFailure(logId: string, attempt: number, error: Error): Promise<void> {
  await prisma.failureLog.create({
    data: {
      interactionLogId: logId,
      attemptNumber: attempt,
      errorMessage: error.message,
      stackTrace: error.stack,
    },
  });

  await prisma.interactionLog.update({
    where: { id: logId },
    data: { retryCount: { increment: 1 } },
  });
}

export async function retryFailedInteraction(logId: string): Promise<void> {
  const log = await prisma.interactionLog.findUnique({
    where: { id: logId },
    include: { failures: true },
  });

  if (!log || log.status !== InteractionStatus.FAILED) {
    throw new Error('Interaction not found or not in failed state');
  }

  const interaction = log.requestPayload as unknown as DiscordInteraction;
  const attempt = log.retryCount + 1;

  try {
    const response = await executeCommand(
      log.commandName || 'unknown',
      parseOptions(interaction),
      { id: log.userId, username: log.userName || 'unknown' },
      log.serverId
        ? await prisma.discordServer.findUnique({ where: { id: log.serverId } })
        : null
    );

    await prisma.interactionLog.update({
      where: { id: logId },
      data: {
        status: InteractionStatus.COMPLETED,
        responsePayload: response.data as object,
        errorMessage: null,
        retryCount: attempt,
      },
    });
  } catch (error) {
    const err = error as Error;
    await recordFailure(logId, attempt, err);
    throw err;
  }
}
