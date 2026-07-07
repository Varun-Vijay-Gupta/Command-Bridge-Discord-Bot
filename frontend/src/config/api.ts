const DEFAULT_RENDER_API = 'https://command-bridge-discord-bot.onrender.com/api';

/** API base URL — env override, then production Render fallback, then local Vite proxy. */
export function getApiBase(): string {
  const configured = import.meta.env.VITE_API_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  if (import.meta.env.PROD) {
    return DEFAULT_RENDER_API;
  }
  return '/api';
}