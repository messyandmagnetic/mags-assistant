import { env } from '../../lib/env.js';
import { notion } from '../../lib/notion.js';
import { ensureProfileDb } from '../../lib/notion_profile.js';

export default async function(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false });
  if (!env.NOTION_TOKEN) return res.json({ ok: false, reason: 'missing NOTION_TOKEN' });
  const hq = env.NOTION_HQ_PAGE_ID;
  if (!hq) return res.json({ ok: false, reason: 'missing NOTION_HQ_PAGE_ID' });
  try {
    const dbId = await ensureProfileDb({ notion, hqPageId: hq });
    const r = await notion.databases.query({ database_id: dbId, page_size: 100 });
    const items = r.results.map((p) => {
      const props = p.properties || {};
      return {
        id: p.id,
        key: props.Key?.title?.[0]?.plain_text || '',
        value: props.Value?.rich_text?.[0]?.plain_text || '',
        visibility: props.Visibility?.select?.name || '',
      };
    });
    res.json({ ok: true, items });
  } catch (e) {
    res.json({ ok: false, reason: e.message });
  }
}
