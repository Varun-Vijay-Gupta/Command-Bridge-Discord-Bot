import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  DISCORD_PUBLIC_KEY: z.string().min(1),
  DISCORD_APPLICATION_ID: z.string().min(1),
  DISCORD_BOT_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),
  DISCORD_REDIRECT_URI: z.string().url().optional(),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  MIRROR_WEBHOOK_URL: z.string().url().optional(),
  MIRROR_WEBHOOK_TYPE: z.enum(['slack', 'discord']).default('discord'),
  GROQ_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  AI_PROVIDER: z.enum(['groq', 'gemini', 'none']).default('none'),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

function getEnv() {
  if (!parsed.success) {
    console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  return parsed.data;
}

let _env: z.infer<typeof envSchema> | null = null;

export const env = new Proxy({} as z.infer<typeof envSchema>, {
  get(_target, prop: string) {
    if (!_env) _env = getEnv();
    return _env[prop as keyof typeof _env];
  },
});
