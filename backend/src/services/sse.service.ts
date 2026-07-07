import { Response } from 'express';
import { InteractionLog } from '@prisma/client';

type SseClient = { id: string; res: Response };

const clients = new Map<string, SseClient>();

export function addSseClient(res: Response): string {
  const id = crypto.randomUUID();
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(': connected\n\n');

  clients.set(id, { id, res });

  res.on('close', () => {
    clients.delete(id);
  });

  return id;
}

export function broadcastInteraction(log: InteractionLog): void {
  const payload = JSON.stringify({
    type: 'interaction',
    data: log,
  });

  for (const [, client] of clients) {
    try {
      client.res.write(`data: ${payload}\n\n`);
    } catch {
      clients.delete(client.id);
    }
  }
}

export function broadcastStats(stats: {
  total: number;
  completed: number;
  failed: number;
  deferred: number;
}): void {
  const payload = JSON.stringify({ type: 'stats', data: stats });

  for (const [, client] of clients) {
    try {
      client.res.write(`data: ${payload}\n\n`);
    } catch {
      clients.delete(client.id);
    }
  }
}

export function getConnectedClients(): number {
  return clients.size;
}
