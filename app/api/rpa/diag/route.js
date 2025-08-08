export async function GET() {
  const base =
    process.env.BROWSERLESS_BASE || 'https://production-sfo.browserless.io';
  const key = process.env.BROWSERLESS_API_KEY || process.env.BROWSERLESS_TOKEN || '';
  return Response.json({
    ok: true,
    base,
    haveKey: Boolean(key),
    keyPreview: key ? `${key.slice(0,4)}…${key.slice(-4)} (${key.length})` : null
  });
}
