const fs = require('fs/promises');
const path = require('path');

async function fetchAllBlocks(id, headers) {
  const results = [];
  let cursor = undefined;
  while (true) {
    const url = `https://api.notion.com/v1/blocks/${id}/children?page_size=100` + (cursor ? `&start_cursor=${cursor}` : '');
    const res = await fetch(url, { headers });
    if (!res.ok) break;
    const data = await res.json();
    results.push(...(data.results || []));
    if (!data.has_more) break;
    cursor = data.next_cursor;
  }
  return results;
}

async function computeCharCount(id, headers) {
  let total = 0;
  const queue = [id];
  while (queue.length) {
    const current = queue.shift();
    let blocks;
    try {
      blocks = await fetchAllBlocks(current, headers);
    } catch {
      continue;
    }
    for (const block of blocks) {
      if (block.has_children) queue.push(block.id);
      const rich = block[block.type]?.rich_text;
      if (Array.isArray(rich)) {
        for (const r of rich) total += (r.plain_text || '').length;
      }
    }
  }
  return total;
}

(async () => {
  const cfgPath = path.join(__dirname, '..', 'public', 'mags-config.json');
  const cfg = JSON.parse(await fs.readFile(cfgPath, 'utf8'));
  const sources = Array.isArray(cfg.brain?.sources) ? cfg.brain.sources.filter(s => s.type === 'notion_page') : [];
  const headers = { 'Notion-Version': '2022-06-28' };
  const token = process.env.NOTION_TOKEN;
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const index = [];
  for (const src of sources) {
    let updated = null;
    let charCount = 0;
    if (token) {
      try {
        const pageRes = await fetch(`https://api.notion.com/v1/pages/${src.id}`, { headers });
        if (pageRes.ok) {
          const pageData = await pageRes.json();
          updated = pageData.last_edited_time;
        } else {
          console.error(`page_fetch_failed_${src.id}`);
        }
        charCount = await computeCharCount(src.id, headers);
      } catch (err) {
        console.error('notion_error', err.message);
      }
    } else {
      console.error('missing_NOTION_TOKEN');
    }
    index.push({ id: src.id, name: src.name, updated, charCount });
  }

  const outPath = path.join(__dirname, '..', 'public', '.brain-index.json');
  await fs.writeFile(outPath, JSON.stringify(index, null, 2));
  console.log('indexed_pages', index.length);
  index.forEach(p => console.log(`${p.name}: updated=${p.updated} chars=${p.charCount}`));
})();
