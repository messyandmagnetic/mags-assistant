import { Client } from '@notionhq/client';

export function getNotion() {
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    throw new Error('Missing NOTION_TOKEN');
  }
  return new Client({ auth: token });
}
