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
});

export const env = envSchema.parse(process.env);

export function requireEnv<K extends keyof typeof env>(key: K): string {
  const value = env[key];
  if (!value) throw new Error(`Missing env: ${key}`);
  return value;
}
