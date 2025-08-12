import { z } from 'zod';

const envSchema = z.object({
  API_BASE: z.string().optional(),
  WORKER_KEY: z.string().optional(),
  MAGS_KEY: z.string().optional(),
  NOTION_TOKEN: z.string(),
  NOTION_HQ_PAGE_ID: z.string().optional(),
  NOTION_INBOX_PAGE_ID: z.string().optional(),
  NOTION_QUEUE_DB: z.string().optional(),
  NOTION_DB_RUNS_ID: z.string().optional(),
  PRODUCTS_DB_ID: z.string().optional(),
  DONOR_DB_ID: z.string().optional(),
  OUTREACH_DB_ID: z.string().optional(),
  CONTENT_DB_ID: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  CHAT_PASSWORD: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  NOTIFY_EMAIL: z.string().optional(),
  NOTIFY_WEBHOOK: z.string().optional(),
  BRAND_PRIMARY_HEX: z.string().regex(/^#?[0-9A-Fa-f]{6}$/).optional(),
  BRAND_SECONDARY_HEX: z.string().regex(/^#?[0-9A-Fa-f]{6}$/).optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  TELEGRAM_CALLBACK_SECRET: z.string().optional(),
  TALLY_API_KEY: z.string().optional(),
  TALLY_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_SITE_URL: z.string().optional(),
  MM_DRIVE_ROOT_ID: z.string().optional(),
  CHAN_DRIVE_ROOT_ID: z.string().optional(),
  MM_DRIVE_INBOX_ID: z.string().optional(),
  MM_DRIVE_REVIEW_ID: z.string().optional(),
  MM_DRIVE_READY_ID: z.string().optional(),
  MM_DRIVE_ARCHIVE_ID: z.string().optional(),
  MM_DRIVE_FAILED_ID: z.string().optional(),
  MM_DRIVE_CHANCUB_PARENT_ID: z.string().optional(),
  MM_DRIVE_MM_PARENT_ID: z.string().optional(),
  SALES_TAX_STATE: z.string().optional(),
  SALES_TAX_ZIP: z.string().optional(),
  APPROVAL_MODE: z.enum(['strict', 'normal', 'auto']).optional().default('normal'),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;

export function requireEnv<K extends keyof Env>(key: K): Env[K] {
  const value = env[key];
  if (!value) throw new Error(`Missing env: ${String(key)}`);
  return value;
}
