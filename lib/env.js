export const env = {
  API_BASE: process.env.API_BASE,
  WORKER_KEY: process.env.WORKER_KEY,
  MAGS_KEY: process.env.MAGS_KEY,
  CRON_SECRET: process.env.CRON_SECRET,
  NOTION_TOKEN: process.env.NOTION_TOKEN,
  NOTION_DATABASE_ID: process.env.NOTION_DATABASE_ID,
  NOTION_INBOX_PAGE_ID: process.env.NOTION_INBOX_PAGE_ID,
  NOTION_HQ_PAGE_ID: process.env.NOTION_HQ_PAGE_ID,
  BROWSERLESS_API_KEY: process.env.BROWSERLESS_API_KEY,
  BROWSERLESS_TOKEN: process.env.BROWSERLESS_TOKEN || process.env.BROWSERLESS_API_KEY,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  NOTION_STRIPE_DB_ID: process.env.NOTION_STRIPE_DB_ID,
  NOTION_DB_RUNS_ID: process.env.NOTION_DB_RUNS_ID,
  NOTION_QUEUE_DB_ID: process.env.NOTION_QUEUE_DB_ID,
  NOTION_QUEUE_DB: process.env.NOTION_QUEUE_DB,
  NOTION_SOCIAL_DB: process.env.NOTION_SOCIAL_DB,
  DRY_RUN: process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true',
  ALLOWED_DOMAINS: (process.env.ALLOWED_DOMAINS || '')
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean),
  EXECUTION_PAUSED: process.env.EXECUTION_PAUSED === '1' || process.env.EXECUTION_PAUSED === 'true',
};

export function requireEnv(name) {
  const v = env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}
