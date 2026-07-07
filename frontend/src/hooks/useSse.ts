import { useEffect, useRef, useCallback } from 'react';
import { InteractionLog, Stats } from '../api/client';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface SseEvent {
  type: 'interaction' | 'stats';
  data: InteractionLog | Stats;
}

export function useSse(
  onInteraction?: (log: InteractionLog) => void,
  onStats?: (stats: Stats) => void
) {
  const onInteractionRef = useRef(onInteraction);
  const onStatsRef = useRef(onStats);
  onInteractionRef.current = onInteraction;
  onStatsRef.current = onStats;

  const connect = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const url = `${API_BASE}/settings/events`;
    const controller = new AbortController();

    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    }).then(async (res) => {
      if (!res.ok || !res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event: SseEvent = JSON.parse(line.slice(6));
              if (event.type === 'interaction') {
                onInteractionRef.current?.(event.data as InteractionLog);
              } else if (event.type === 'stats') {
                onStatsRef.current?.(event.data as Stats);
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      }
    }).catch(() => {
      // reconnect on failure
      setTimeout(connect, 5000);
    });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const cleanup = connect();
    return () => cleanup?.();
  }, [connect]);
}
