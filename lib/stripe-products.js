import { notion } from './notion.js';
import { env } from './env.js';
import { getStripe } from './clients/stripe.js';

function rt(text) {
  return { rich_text: [{ type: 'text', text: { content: text || '' } }] };
}

const TRACKER_PROPS = {
  ProductId: { rich_text: {} },
  PriceId: { rich_text: {} },
  Name: { title: {} },
  Active: { checkbox: {} },
  UnitAmount: { number: {} },
  Currency: { select: {} },
  Recurring: { select: { options: [{ name: 'none' }, { name: 'month' }, { name: 'year' }] } },
  TaxCode: { rich_text: {} },
  ImageURL: { url: {} },
  Description: { rich_text: {} },
  UpdatedAt: { date: {} },
  Notes: { rich_text: {} },
  SuggestedPrice: { number: {} },
  AuditNote: { rich_text: {} },
};

async function ensureTrackerSchema(dbId) {
  const db = await notion.databases.retrieve({ database_id: dbId });
  const update = { properties: {} };
  for (const [name, def] of Object.entries(TRACKER_PROPS)) {
    if (!db.properties[name]) update.properties[name] = def;
  }
  if (Object.keys(update.properties).length) {
    await notion.databases.update({ database_id: dbId, ...update });
  }
}

async function fetchExisting(dbId) {
  const map = new Map();
  let cursor;
  do {
    const res = await notion.databases.query({ database_id: dbId, start_cursor: cursor, page_size: 100 });
    for (const page of res.results) {
      const p = page.properties || {};
      const pid = p.ProductId?.rich_text?.[0]?.plain_text;
      const prid = p.PriceId?.rich_text?.[0]?.plain_text;
      if (pid && prid) map.set(`${pid}|${prid}`, page.id);
    }
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return map;
}

export async function syncStripeProducts() {
  const dbId = env.NOTION_STRIPE_DB_ID;
  if (!dbId) throw new Error('Missing NOTION_STRIPE_DB_ID');
  await ensureTrackerSchema(dbId);
  const existing = await fetchExisting(dbId);
  const stripe = getStripe();
  const stats = { products: 0, prices: 0, upserts: 0, skipped: 0 };
  const seenProducts = new Set();
  const iterator = stripe.prices.list({ active: true, expand: ['data.product'], limit: 100 }).autoPagingEach;
  for await (const price of iterator()) {
    stats.prices++;
    const product = price.product;
    if (product && !seenProducts.has(product.id)) {
      seenProducts.add(product.id);
      stats.products++;
    }
    const key = `${product.id}|${price.id}`;
    const props = {
      ProductId: rt(product.id),
      PriceId: rt(price.id),
      Name: { title: [{ type: 'text', text: { content: product.name } }] },
      Active: { checkbox: product.active && price.active },
      UnitAmount: { number: price.unit_amount || 0 },
      Currency: { select: { name: price.currency } },
      Recurring: { select: { name: price.recurring?.interval || 'none' } },
      TaxCode: rt(price.tax_code || ''),
      ImageURL: { url: product.images?.[0] || null },
      Description: rt(product.description || ''),
      UpdatedAt: { date: { start: new Date().toISOString() } },
    };
    const pageId = existing.get(key);
    try {
      if (pageId) {
        await notion.pages.update({ page_id: pageId, properties: props });
      } else {
        await notion.pages.create({ parent: { database_id: dbId }, properties: props });
      }
      stats.upserts++;
    } catch {
      stats.skipped++;
    }
  }
  return stats;
}

function roundEnding(amount, endingStr) {
  const ending = parseFloat(endingStr);
  if (isNaN(ending)) return Math.round(amount * 100) / 100;
  const base = Math.floor(amount);
  let candidate = base + ending;
  if (candidate < amount) candidate = base + 1 + ending;
  return Math.round(candidate * 100) / 100;
}

async function loadPriceRules() {
  let dbId = env.NOTION_PRICE_RULES_DB_ID;
  if (!dbId && env.NOTION_HQ_PAGE_ID) {
    const db = await notion.databases.create({
      parent: { page_id: env.NOTION_HQ_PAGE_ID },
      title: [{ type: 'text', text: { content: 'Price Rules' } }],
      properties: {
        RuleName: { title: {} },
        Match: { rich_text: {} },
        MarkupPercent: { number: {} },
        RoundTo: {
          select: {
            options: [
              { name: '.00' },
              { name: '.49' },
              { name: '.79' },
              { name: '.89' },
              { name: '.95' },
              { name: '.99' },
            ],
          },
        },
        MinPrice: { number: {} },
        MaxPrice: { number: {} },
      },
    });
    dbId = db.id;
    env.NOTION_PRICE_RULES_DB_ID = dbId;
  }
  if (!dbId) return [];
  const rules = [];
  let cursor;
  do {
    const res = await notion.databases.query({ database_id: dbId, start_cursor: cursor, page_size: 100 });
    for (const page of res.results) {
      const p = page.properties || {};
      const match = p.Match?.rich_text?.[0]?.plain_text?.toLowerCase() || '';
      const markup = p.MarkupPercent?.number;
      const roundTo = p.RoundTo?.select?.name;
      const min = p.MinPrice?.number;
      const max = p.MaxPrice?.number;
      rules.push({ match, markup, roundTo, min, max });
    }
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return rules;
}

export async function runPriceAudit() {
  const dbId = env.NOTION_STRIPE_DB_ID;
  if (!dbId) throw new Error('Missing NOTION_STRIPE_DB_ID');
  await ensureTrackerSchema(dbId);
  const defaults = {
    markup: parseFloat(env.DEFAULT_MARKUP_PERCENT) || 12,
    round: env.DEFAULT_ROUNDING || '.99',
    min: parseFloat(env.PRICE_AUDIT_MIN) || 0,
    max: parseFloat(env.PRICE_AUDIT_MAX) || 0,
  };
  const rules = await loadPriceRules();
  const stats = { audited: 0, changed: 0, unchanged: 0 };
  let cursor;
  do {
    const res = await notion.databases.query({ database_id: dbId, start_cursor: cursor, page_size: 100 });
    for (const page of res.results) {
      const props = page.properties || {};
      const name = props.Name?.title?.[0]?.plain_text || '';
      const unit = props.UnitAmount?.number || 0;
      const existing = props.SuggestedPrice?.number;
      const rule = rules.find((r) => r.match && name.toLowerCase().includes(r.match));
      const markup = rule?.markup ?? defaults.markup;
      const roundTo = rule?.roundTo || defaults.round;
      const min = rule?.min ?? defaults.min;
      const max = rule?.max ?? defaults.max;
      let price = unit / 100 * (1 + markup / 100);
      price = roundEnding(price, roundTo);
      if (price < min) price = min;
      if (max > 0 && price > max) price = max;
      const note = `Rounded to ${roundTo}; +${markup}% from baseline`;
      if (existing === price) stats.unchanged++; else stats.changed++;
      await notion.pages.update({
        page_id: page.id,
        properties: {
          SuggestedPrice: { number: price },
          AuditNote: rt(note),
        },
      });
      stats.audited++;
    }
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return stats;
}
