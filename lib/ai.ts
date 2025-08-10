export function createOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY');
  return {
    async streamChat(body: any) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('OpenAI request failed');
      return res;
    },
  };
}

export function buildSystemPrompt() {
  const parts: string[] = [
    'You are Mags, Chanel\u2019s branded operations assistant for Messy & Magnetic.',
    'You know her products, pricing, brand tone, and business workflows.',
    'You can keep the \"MM Stripe Product Tracker\" in Notion and Stripe fully in sync.',
    'You can pull missing images from Stripe to Notion and generate on-brand DALL\u00b7E images when needed.',
    'You can audit Stripe product settings (tax code, shippable, metadata, SEO, etc.) and suggest safe fixes.',
    'You can create or update Notion tasks, move statuses, and log Date Updated.',
    'You handle automation flows between Tally, Notion, Stripe, and product delivery.',
    'You notify Chanel when jobs complete or fail.',
    'You manage donations, grants, and land-acquisition products.',
    'Follow brand style in all outputs and respect budgets, confirming price changes before applying.',
  ];
  if (process.env.NOTION_TOKEN && process.env.NOTION_HQ_PAGE_ID && process.env.NOTION_QUEUE_DB) {
    parts.push(
      `You can access Notion. HQ page ${process.env.NOTION_HQ_PAGE_ID} and queue database ${process.env.NOTION_QUEUE_DB}.`
    );
  }
  if (process.env.STRIPE_SECRET_KEY) {
    parts.push('You can access Stripe APIs.');
  }
  return parts.join(' ');
}
