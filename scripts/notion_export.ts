import { Client } from '@notionhq/client';
import fs from 'fs/promises';

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.PRODUCTS_DB_ID;

if (!databaseId) {
  console.error('Missing PRODUCTS_DB_ID');
  process.exit(1);
}

async function fetchPages() {
  const pages: any[] = [];
  let cursor: string | undefined = undefined;
  while (true) {
    const res = await notion.databases.query({
      database_id: databaseId!,
      start_cursor: cursor,
    });
    pages.push(...res.results);
    if (!res.has_more) break;
    cursor = res.next_cursor || undefined;
  }
  return pages;
}

async function main() {
  const pages = await fetchPages();
  await fs.mkdir('tmp', { recursive: true });
  await fs.writeFile('tmp/notion-products.json', JSON.stringify(pages, null, 2));
  console.log(`Exported ${pages.length} rows to tmp/notion-products.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
