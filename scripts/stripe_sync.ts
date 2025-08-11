import { Client } from '@notionhq/client';
import Stripe from 'stripe';

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

const databaseId = process.env.PRODUCTS_DB_ID;
const dry = process.argv.includes('--dry');

if (!databaseId) {
  console.error('Missing PRODUCTS_DB_ID');
  process.exit(1);
}

interface NotionProduct {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  imageUrl?: string;
  stripeProductId?: string;
  stripePriceId?: string;
  unitAmount?: number;
  currency: string;
  metadata: Record<string, string>;
  taxBehavior?: Stripe.ProductCreateParams.TaxBehavior;
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

function parseMetadata(raw?: string): Record<string, string> {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const out: Record<string, string> = {};
    raw.split(',').forEach((kv) => {
      const [k, v] = kv.split('=');
      if (k && v) out[k.trim()] = v.trim();
    });
    return out;
  }
}

function parsePage(page: any): NotionProduct {
  const props = page.properties;
  const name = props.Name?.title?.[0]?.plain_text || 'Unnamed';
  const description = props.Description?.rich_text?.[0]?.plain_text;
  const active = props.Active?.checkbox ?? true;
  const imageUrl = props['Image URL']?.url || undefined;
  const stripeProductId = props['Stripe Product ID']?.rich_text?.[0]?.plain_text;
  const stripePriceId = props['Stripe Price ID']?.rich_text?.[0]?.plain_text;
  const unitAmount = props['Unit Amount']?.number || undefined;
  const currency = props.Currency?.select?.name || 'usd';
  const metadata = parseMetadata(props.Metadata?.rich_text?.[0]?.plain_text);
  const taxBehavior = props['Tax Behavior']?.select?.name as
    | Stripe.ProductCreateParams.TaxBehavior
    | undefined;
  return {
    id: page.id,
    name,
    description,
    active,
    imageUrl,
    stripeProductId,
    stripePriceId,
    unitAmount,
    currency,
    metadata,
    taxBehavior,
  };
}

async function updateNotion(pageId: string, updates: Record<string, string>) {
  await notion.pages.update({
    page_id: pageId,
    properties: Object.fromEntries(
      Object.entries(updates).map(([k, v]) => [k, { rich_text: [{ type: 'text', text: { content: v } }] }])
    ),
  });
}

async function syncProduct(p: NotionProduct) {
  let productId = p.stripeProductId;
  let priceId = p.stripePriceId;

  if (productId) {
    if (dry) {
      console.log(`[dry] update product ${productId}`);
    } else {
      const existing = await stripe.products.retrieve(productId);
      const images = p.imageUrl ? [p.imageUrl] : existing.images;
      await stripe.products.update(productId, {
        name: p.name,
        description: p.description,
        active: p.active,
        images,
        tax_behavior: p.taxBehavior,
        metadata: p.metadata,
      });
    }
  } else {
    if (dry) {
      console.log('[dry] create product for', p.name);
      productId = 'new_product_id';
    } else {
      const created = await stripe.products.create({
        name: p.name,
        description: p.description,
        active: p.active,
        images: p.imageUrl ? [p.imageUrl] : undefined,
        tax_behavior: p.taxBehavior,
        metadata: p.metadata,
      });
      productId = created.id;
      await updateNotion(p.id, { 'Stripe Product ID': productId });
    }
  }

  if (priceId) {
    if (dry) {
      console.log(`[dry] update price ${priceId} metadata`);
    } else {
      await stripe.prices.update(priceId, { metadata: p.metadata });
    }
  } else if (p.unitAmount) {
    if (dry) {
      console.log('[dry] create price');
      priceId = 'new_price_id';
    } else {
      const price = await stripe.prices.create({
        currency: p.currency,
        unit_amount: p.unitAmount,
        product: productId!,
        tax_behavior: p.taxBehavior,
        metadata: p.metadata,
      });
      priceId = price.id;
      await updateNotion(p.id, { 'Stripe Price ID': priceId });
    }
  }

  if (!dry && productId && priceId) {
    await stripe.products.update(productId, { default_price: priceId });
  } else if (dry && productId && priceId) {
    console.log(`[dry] set default price ${priceId} on product ${productId}`);
  }
}

async function main() {
  const pages = await fetchPages();
  for (const page of pages) {
    const p = parsePage(page);
    await syncProduct(p);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
