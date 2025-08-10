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
  NOTION_DB_RUNS_ID: process.env.NOTION_DB_RUNS_ID,
  NOTION_QUEUE_DB_ID: process.env.NOTION_QUEUE_DB_ID,
  NOTION_QUEUE_DB: process.env.NOTION_QUEUE_DB,
};

export function requireEnv(name) {
  const v = env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}
