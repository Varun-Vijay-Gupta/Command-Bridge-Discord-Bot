import nacl from 'tweetnacl';
import { env } from '../config/env';
import { logger } from '../config/logger';

export function verifyDiscordSignature(
  rawBody: string,
  signature: string,
  timestamp: string
): boolean {
  try {
    const publicKey = Buffer.from(env.DISCORD_PUBLIC_KEY, 'hex');
    const signatureBuffer = Buffer.from(signature, 'hex');
    const message = Buffer.from(timestamp + rawBody);

    return nacl.sign.detached.verify(message, signatureBuffer, publicKey);
  } catch (error) {
    logger.warn('Discord signature verification failed', { error });
    return false;
  }
}

export enum InteractionType {
  PING = 1,
  APPLICATION_COMMAND = 2,
  MESSAGE_COMPONENT = 3,
  APPLICATION_COMMAND_AUTOCOMPLETE = 4,
  MODAL_SUBMIT = 5,
}

export enum InteractionResponseType {
  PONG = 1,
  CHANNEL_MESSAGE_WITH_SOURCE = 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE = 5,
  DEFERRED_UPDATE_MESSAGE = 6,
  UPDATE_MESSAGE = 7,
  APPLICATION_COMMAND_AUTOCOMPLETE_RESULT = 8,
  MODAL = 9,
}

export enum MessageComponentType {
  ACTION_ROW = 1,
  BUTTON = 2,
}

export enum ButtonStyle {
  PRIMARY = 1,
  SECONDARY = 2,
  SUCCESS = 3,
  DANGER = 4,
  LINK = 5,
}

export interface DiscordInteraction {
  id: string;
  application_id: string;
  type: InteractionType;
  token: string;
  version: number;
  guild_id?: string;
  channel_id?: string;
  member?: {
    user: {
      id: string;
      username: string;
      global_name?: string;
    };
  };
  user?: {
    id: string;
    username: string;
    global_name?: string;
  };
  data?: {
    id: string;
    name: string;
    type: number;
    options?: Array<{
      name: string;
      type: number;
      value?: string | number | boolean;
      options?: Array<{ name: string; type: number; value?: string | number | boolean }>;
    }>;
    custom_id?: string;
    components?: unknown[];
  };
}

export interface InteractionResponse {
  type: InteractionResponseType;
  data?: InteractionResponseData;
}

export interface InteractionResponseData {
  content?: string;
  embeds?: DiscordEmbed[];
  flags?: number;
  title?: string;
  custom_id?: string;
  components?: MessageActionRow[];
}

export interface MessageActionRow {
  type: MessageComponentType;
  components: Array<{
    type: MessageComponentType | number;
    style?: ButtonStyle;
    label?: string;
    custom_id?: string;
    min_length?: number;
    max_length?: number;
    required?: boolean;
  }>;
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
  timestamp?: string;
}

export const EPHEMERAL_FLAG = 1 << 6;

export function buildPongResponse(): InteractionResponse {
  return { type: InteractionResponseType.PONG };
}

export function buildMessageResponse(
  content: string,
  ephemeral = false,
  components?: MessageActionRow[]
): InteractionResponse {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content,
      flags: ephemeral ? EPHEMERAL_FLAG : undefined,
      components,
    },
  };
}

export function buildDeferredResponse(ephemeral = false): InteractionResponse {
  return {
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      flags: ephemeral ? EPHEMERAL_FLAG : undefined,
    },
  };
}

export function buildEmbedResponse(
  embed: DiscordEmbed,
  ephemeral = false,
  components?: MessageActionRow[]
): InteractionResponse {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [embed],
      flags: ephemeral ? EPHEMERAL_FLAG : undefined,
      components,
    },
  };
}

export function buildModalResponse(
  customId: string,
  title: string,
  components: MessageActionRow[]
): InteractionResponse {
  return {
    type: InteractionResponseType.MODAL,
    data: {
      custom_id: customId,
      title,
      components,
    },
  };
}

function resolveApplicationId(applicationId?: string): string {
  return applicationId || env.DISCORD_APPLICATION_ID;
}

export async function sendFollowUp(
  interactionToken: string,
  payload: {
    content?: string;
    embeds?: DiscordEmbed[];
    components?: MessageActionRow[];
    flags?: number;
  },
  applicationId?: string
): Promise<void> {
  const url = `https://discord.com/api/v10/webhooks/${resolveApplicationId(applicationId)}/${interactionToken}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord follow-up failed: ${response.status} ${text}`);
  }
}

export async function editOriginalResponse(
  interactionToken: string,
  payload: {
    content?: string;
    embeds?: DiscordEmbed[];
    components?: MessageActionRow[];
  },
  applicationId?: string
): Promise<void> {
  const url = `https://discord.com/api/v10/webhooks/${resolveApplicationId(applicationId)}/${interactionToken}/messages/@original`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord edit original failed: ${response.status} ${text}`);
  }
}

export function getInteractionUser(interaction: DiscordInteraction): { id: string; username: string } {
  const user = interaction.member?.user || interaction.user;
  return {
    id: user?.id || 'unknown',
    username: user?.global_name || user?.username || 'unknown',
  };
}
