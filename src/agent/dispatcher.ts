export type AgentPayload = any;
export type AgentEnv = any;
export type AgentResponse = Record<string, any>;
export type AgentFn = (payload: AgentPayload, env: AgentEnv) => Promise<AgentResponse>;

const agents: Record<string, AgentFn> = {
  'sync/stripe-to-notion': async (_payload, env) => {
    // fetch Stripe products and prices
    if (!env.STRIPE_SECRET_KEY || !env.NOTION_TOKEN || !env.NOTION_DATABASE_ID) {
      return { ok: false, error: 'missing env' };
    }
    const stripeHeaders = {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
    };
    const [prodRes, priceRes] = await Promise.all([
      fetch('https://api.stripe.com/v1/products?limit=100', { headers: stripeHeaders }),
      fetch('https://api.stripe.com/v1/prices?limit=100', { headers: stripeHeaders }),
    ]);
    const products = (await prodRes.json()).data || [];
    const prices = (await priceRes.json()).data || [];
    const prodMap: Record<string, any> = {};
    for (const p of products) prodMap[p.id] = p;

    const notionHeaders = {
      Authorization: `Bearer ${env.NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    };
    const dbId = env.NOTION_DATABASE_ID;
    let updated = 0;
    for (const price of prices) {
      const product = prodMap[price.product];
      const name = price.nickname || product?.name || price.id;
      const query = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
        method: 'POST',
        headers: notionHeaders,
        body: JSON.stringify({
          filter: {
            property: 'Stripe Price ID',
            rich_text: { equals: price.id },
          },
        }),
      }).then((r) => r.json());
      const props: any = {
        Name: { title: [{ text: { content: name } }] },
        Price: { number: price.unit_amount ? price.unit_amount / 100 : 0 },
        Currency: { select: { name: price.currency.toUpperCase() } },
        Active: { checkbox: price.active },
        'Stripe Product ID': { rich_text: [{ text: { content: String(price.product) } }] },
        'Stripe Price ID': { rich_text: [{ text: { content: price.id } }] },
        'Date Updated': { date: { start: new Date().toISOString() } },
      };
      if (query.results && query.results[0]) {
        await fetch(`https://api.notion.com/v1/pages/${query.results[0].id}`, {
          method: 'PATCH',
          headers: notionHeaders,
          body: JSON.stringify({ properties: props }),
        });
      } else {
        await fetch('https://api.notion.com/v1/pages', {
          method: 'POST',
          headers: notionHeaders,
          body: JSON.stringify({
            parent: { database_id: dbId },
            properties: props,
          }),
        });
      }
      updated++;
    }
    return { ok: true, updated };
  },
  'audit/prices': async (_payload, env) => {
    if (!env.STRIPE_SECRET_KEY || !env.NOTION_TOKEN || !env.NOTION_DATABASE_ID) {
      return { ok: false, error: 'missing env' };
    }
    const stripeHeaders = { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` };
    const priceRes = await fetch('https://api.stripe.com/v1/prices?limit=100', { headers: stripeHeaders });
    const prices = (await priceRes.json()).data || [];
    const priceMap: Record<string, any> = {};
    for (const p of prices) priceMap[p.id] = p;

    const notionHeaders = {
      Authorization: `Bearer ${env.NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    };
    const dbId = env.NOTION_DATABASE_ID;
    const diffs: any[] = [];
    let cursor: string | undefined = undefined;
    while (true) {
      const query = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
        method: 'POST',
        headers: notionHeaders,
        body: JSON.stringify({ start_cursor: cursor }),
      }).then((r) => r.json());
      for (const page of query.results || []) {
        const props: any = page.properties || {};
        const priceId = props['Stripe Price ID']?.rich_text?.[0]?.plain_text;
        const notionPrice = props['Price']?.number;
        if (priceId && priceMap[priceId]) {
          const stripePrice = priceMap[priceId].unit_amount ? priceMap[priceId].unit_amount / 100 : 0;
          if (stripePrice !== notionPrice) {
            diffs.push({ priceId, stripe: stripePrice, notion: notionPrice });
          }
        }
      }
      if (!query.has_more) break;
      cursor = query.next_cursor;
    }
    return { ok: true, diffs };
  },
  'tally/ingest': async (payload, env) => {
    if (env.TALLY_WEBHOOK_SECRET && payload?.secret !== env.TALLY_WEBHOOK_SECRET) {
      return { ok: false, error: 'unauthorized' };
    }
    // placeholder for later logic
    return { ok: true };
  },
};

export async function runAgent(name: string, payload: AgentPayload, env: AgentEnv) {
  const fn = agents[name];
  if (!fn) {
    return { ok: false, error: `unknown agent: ${name}` };
  }
  try {
    return await fn(payload, env);
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export const agentNames = Object.keys(agents);
