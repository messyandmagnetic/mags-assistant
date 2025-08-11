import { z } from 'zod';

const envSchema = z.object({
  API_BASE: z.string().url().optional(),
  WORKER_KEY: z.string().optional(),
  MAGS_KEY: z.string().optional(),
  NOTION_TOKEN: z.string().optional(),
  NOTION_DATABASE_ID: z.string().optional(),
  NOTION_INBOX_PAGE_ID: z.string().optional(),
  NOTION_HQ_PAGE_ID: z.string().optional(),
  BROWSERLESS_API_KEY: z.string().optional(),
  NOTION_DB_RUNS_ID: z.string().optional(),
  NOTION_GRANT_PAGE_ID: z.string().optional(),
  DONATION_PRODUCTS_DB_ID: z.string().optional(),
  BOT_REGISTRY_DB_ID: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  APPROVAL_MODE: z.string().optional(),
});

export const env = envSchema.parse(process.env);

export function requireEnv<K extends keyof typeof env>(key: K): string {
  const value = env[key];
  if (!value) throw new Error(`Missing env: ${key}`);
  return value;
}
