import { env } from '../config/env';
import { logger } from '../config/logger';
import { prisma } from '../config/database';

interface MirrorPayload {
  commandName: string;
  userName: string;
  userId: string;
  guildName?: string;
  channelId?: string;
  status: string;
  summary?: string;
  tags?: string[];
}

export async function mirrorInteraction(payload: MirrorPayload): Promise<void> {
  const settings = await prisma.appSettings.findUnique({ where: { id: 'default' } });
  const webhookUrl = settings?.mirrorWebhookUrl || env.MIRROR_WEBHOOK_URL;
  const webhookType = settings?.mirrorWebhookType || env.MIRROR_WEBHOOK_TYPE;

  if (!webhookUrl) {
    logger.debug('No mirror webhook configured, skipping');
    return;
  }

  try {
    if (webhookType === 'slack') {
      await sendSlackWebhook(webhookUrl, payload);
    } else {
      await sendDiscordWebhook(webhookUrl, payload);
    }
  } catch (error) {
    logger.error('Failed to mirror interaction', { error, payload });
  }
}

async function sendSlackWebhook(url: string, payload: MirrorPayload): Promise<void> {
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `CommandBridge: /${payload.commandName}` },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*User:*\n${payload.userName}` },
        { type: 'mrkdwn', text: `*Status:*\n${payload.status}` },
        { type: 'mrkdwn', text: `*Server:*\n${payload.guildName || 'N/A'}` },
        { type: 'mrkdwn', text: `*Channel:*\n${payload.channelId || 'N/A'}` },
      ],
    },
  ];

  if (payload.summary) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Summary:* ${payload.summary}` },
    } as typeof blocks[0]);
  }

  if (payload.tags?.length) {
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `Tags: ${payload.tags.join(', ')}` }],
    } as unknown as typeof blocks[0]);
  }

  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks }),
  });
}

async function sendDiscordWebhook(url: string, payload: MirrorPayload): Promise<void> {
  const embed = {
    title: `/${payload.commandName}`,
    color: payload.status === 'COMPLETED' ? 0x57f287 : 0xed4245,
    fields: [
      { name: 'User', value: payload.userName, inline: true },
      { name: 'Status', value: payload.status, inline: true },
      { name: 'Server', value: payload.guildName || 'N/A', inline: true },
      { name: 'Channel', value: payload.channelId || 'N/A', inline: true },
    ],
    footer: { text: 'CommandBridge' },
    timestamp: new Date().toISOString(),
  };

  if (payload.summary) {
    embed.fields.push({ name: 'Summary', value: payload.summary, inline: false });
  }

  if (payload.tags?.length) {
    embed.fields.push({ name: 'Tags', value: payload.tags.join(', '), inline: false });
  }

  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [embed] }),
  });
}
