type Env = {
  API_BASE?: string;
  WORKER_KEY?: string;
  MAGS_KEY?: string;
  NOTION_TOKEN?: string;
  NOTION_DATABASE_ID?: string;
  NOTION_INBOX_PAGE_ID?: string;
  NOTION_HQ_PAGE_ID?: string;
  BROWSERLESS_API_KEY?: string;
  NOTION_DB_RUNS_ID?: string;
  OPENAI_API_KEY?: string;
  CHAT_PASSWORD?: string;
  NOTION_QUEUE_DB?: string;
  PRODUCTS_DB_ID?: string;
  STRIPE_SECRET_KEY?: string;
  RESEND_API_KEY?: string;
  NOTIFY_EMAIL?: string;
  NOTIFY_WEBHOOK?: string;
  BRAND_PRIMARY_HEX?: string;
  BRAND_SECONDARY_HEX?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  DONOR_DB_ID?: string;
  OUTREACH_DB_ID?: string;
  CONTENT_DB_ID?: string;
  APPROVAL_MODE?: 'strict' | 'normal' | 'free';
};

export const env = process.env as Env;

export function requireEnv<K extends keyof typeof env>(key: K): string {
  const value = env[key];
  if (!value) throw new Error(`Missing env: ${key}`);
  return value;
}
