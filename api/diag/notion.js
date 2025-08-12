import { env } from '../../lib/env.js';
import { notion } from '../../lib/notion.js';
import { ensureProfileDb } from '../../lib/notion_profile.js';

export default async function(req, res) {
  const next_steps = [];
  if (!env.NOTION_TOKEN) {
    next_steps.push('Set NOTION_TOKEN');
    return res.json({ ok: false, reason: 'missing NOTION_TOKEN', next_steps });
  }
  const hq = env.NOTION_HQ_PAGE_ID;
  if (!hq) {
    next_steps.push('Set NOTION_HQ_PAGE_ID');
    return res.json({ ok: false, reason: 'missing NOTION_HQ_PAGE_ID', next_steps });
  }
  try {
    const profileDbId = await ensureProfileDb({ notion, hqPageId: hq });
    let write = true;
    try {
      const page = await notion.pages.create({
        parent: { database_id: profileDbId },
        properties: {
          Key: { title: [{ text: { content: 'diag-test' } }] },
          Value: { rich_text: [{ text: { content: 'temp' } }] },
        },
      });
      await notion.blocks.delete?.({ block_id: page.id }).catch(() => notion.pages.update({ page_id: page.id, archived: true }));
    } catch (e) {
      write = false;
      next_steps.push('Open the HQ page in Notion → ••• → Add connections → pick Maggie/Mags Assistant → Can edit. If a “Profile” DB exists, open it → ••• → Add connections → pick Maggie.');
    }
    return res.json({ ok: true, profileDbId, write, next_steps });
  } catch (e) {
    return res.json({ ok: false, reason: e.message, next_steps });
  }
}
