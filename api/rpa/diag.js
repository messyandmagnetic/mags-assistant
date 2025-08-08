export default async function handler(req, res) {
  try {
    const tokenA = process.env.BROWSERLESS_API_KEY || "";
    const tokenB = process.env.BROWSERLESS_TOKEN || "";
    const base   = process.env.BROWSERLESS_BASE || "";
    const mask = (s) => (s ? `${s.slice(0,4)}…${s.slice(-4)} (${s.length})` : "(empty)");

    let r = await fetch(`${base || "https://production-sfo.browserless.io"}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": tokenA || tokenB },
      body: JSON.stringify({ ttl: 2000, headless: true })
    });
    const text1 = await r.text();

    let r2 = await fetch(`${base || "https://production-sfo.browserless.io"}/session?token=${encodeURIComponent(tokenA || tokenB)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ttl: 2000, headless: true })
    });
    const text2 = await r2.text();

    res.status(200).json({
      ok: true,
      env: {
        BROWSERLESS_BASE: base || "(unset)",
        BROWSERLESS_API_KEY: mask(tokenA),
        BROWSERLESS_TOKEN: mask(tokenB)
      },
      headerAttempt: { status: r.status, ok: r.ok, preview: text1.slice(0, 160) },
      queryAttempt:  { status: r2.status, ok: r2.ok, preview: text2.slice(0, 160) }
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
}
