import { Client } from '@notionhq/client';

export const notion = new Client({ auth: process.env.NOTION_TOKEN });

export function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}
