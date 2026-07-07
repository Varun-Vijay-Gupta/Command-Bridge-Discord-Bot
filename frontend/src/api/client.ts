import { getApiBase } from '../config/api';

const API_BASE = getApiBase();

export interface Admin {
  id: string;
  email: string;
  name: string | null;
}

export interface DiscordServer {
  id: string;
  guildId: string;
  guildName: string;
  ownerId: string | null;
  botChannelId: string | null;
  isActive: boolean;
  commandRules: CommandRule[];
  _count?: { interactionLogs: number };
  createdAt: string;
}

export interface CommandRule {
  id: string;
  serverId: string;
  commandName: string;
  enabled: boolean;
  responseTemplate: string | null;
  mirrorEnabled: boolean;
  autoTagEnabled: boolean;
  config: Record<string, unknown> | null;
}

export interface InteractionLog {
  id: string;
  interactionId: string;
  serverId: string | null;
  commandName: string | null;
  userId: string;
  userName: string | null;
  channelId: string | null;
  status: 'RECEIVED' | 'PROCESSING' | 'COMPLETED' | 'DEFERRED' | 'FAILED' | 'DUPLICATE';
  requestPayload: unknown;
  responsePayload: unknown;
  errorMessage: string | null;
  tags: string[];
  aiSummary: string | null;
  processingMs: number | null;
  retryCount: number;
  createdAt: string;
  server?: { guildName: string; guildId: string };
  failures?: FailureLog[];
}

export interface FailureLog {
  id: string;
  attemptNumber: number;
  errorMessage: string;
  stackTrace: string | null;
  createdAt: string;
  interactionLog?: {
    id: string;
    commandName: string | null;
    userName: string | null;
    server?: { guildName: string };
  };
}

export interface Stats {
  total: number;
  completed: number;
  failed: number;
  deferred: number;
  recentLogs: Array<{
    id: string;
    commandName: string | null;
    userName: string | null;
    status: string;
    createdAt: string;
  }>;
}

export interface AppSettings {
  mirrorWebhookUrl: string | null;
  mirrorWebhookType: string;
  aiProvider: string;
  discordApplicationId: string;
  frontendUrl: string;
  sseClients: number;
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error || 'Request failed');
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; admin: Admin }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  getMe: () => request<Admin>('/auth/me'),

  getServers: () => request<DiscordServer[]>('/servers'),

  connectServer: (data: {
    guildId: string;
    guildName: string;
    ownerId?: string;
    botChannelId?: string;
  }) =>
    request<DiscordServer>('/servers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateServer: (id: string, data: Partial<DiscordServer>) =>
    request<DiscordServer>(`/servers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteServer: (id: string) =>
    request<void>(`/servers/${id}`, { method: 'DELETE' }),

  getInviteUrl: () => request<{ url: string }>('/servers/invite-url'),

  getCommandRules: (serverId: string) =>
    request<CommandRule[]>(`/commands/${serverId}`),

  updateCommandRule: (
    serverId: string,
    commandName: string,
    data: Partial<CommandRule>
  ) =>
    request<CommandRule>(`/commands/${serverId}/${commandName}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getLogs: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{
      logs: InteractionLog[];
      pagination: { page: number; limit: number; total: number; pages: number };
    }>(`/logs${qs}`);
  },

  getStats: () => request<Stats>('/logs/stats'),

  getLog: (id: string) => request<InteractionLog>(`/logs/${id}`),

  retryLog: (id: string) =>
    request<InteractionLog>(`/logs/${id}/retry`, { method: 'POST' }),

  getFailures: (page = 1) =>
    request<{ failures: FailureLog[]; page: number; limit: number }>(
      `/logs/failures/history?page=${page}`
    ),

  getSettings: () => request<AppSettings>('/settings'),

  updateSettings: (data: Partial<AppSettings>) =>
    request<AppSettings>('/settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

export { ApiError };
