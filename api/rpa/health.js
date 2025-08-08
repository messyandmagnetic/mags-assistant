// /api/rpa/health.js
export default async function handler(req, res) {
  try {
    const token = process.env.BROWSERLESS_API_KEY || process.env.BROWSERLESS_TOKEN;
    if (!token) return res.status(500).json({ ok: false, error: "Missing BROWSERLESS token" });

    const r = await fetch(`https://chrome.browserless.io/metrics?token=${token}`);
    const data = await r.json();

    res.status(200).json({
      ok: true,
      concurrent: data.concurrent,
      maxConcurrent: data.maxConcurrent,
      sessionsRunning: data.sessionsRunning,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
}
