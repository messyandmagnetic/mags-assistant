import { cors, json } from "../../lib/http.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  try {
    if (cors(req, res)) return;
    if (req.method !== "POST") {
      return json(res, 405, { ok: false, error: "Method not allowed" });
    }
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const action = body.action;
    const params = body.params || {};
    const baseUrl = `${req.headers["x-forwarded-proto"] || "http"}://${req.headers.host}`;

    if (action === "pingUrl") {
      const url = params.url;
      try {
        const r = await fetch(url, { method: "HEAD" });
        return json(res, 200, { ok: true, status: r.status });
      } catch (e) {
        return json(res, 200, { ok: false, error: e.message });
      }
    }

    if (action === "vercelDeployStatus") {
      try {
        const r = await fetch("https://www.vercel-status.com/api/v2/status.json");
        const data = await r.json();
        return json(res, 200, { ok: true, status: data.status });
      } catch (e) {
        return json(res, 200, { ok: false, error: e.message });
      }
    }

    if (action === "listOpenPRs") {
      const repo = process.env.GITHUB_REPO || "messyandmagnetic/mags-assistant";
      try {
        const r = await fetch(`https://api.github.com/repos/${repo}/pulls?state=open`, {
          headers: process.env.GITHUB_TOKEN
            ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
            : {},
        });
        const data = await r.json();
        const prs = Array.isArray(data)
          ? data.map((p) => ({ number: p.number, title: p.title, url: p.html_url }))
          : [];
        return json(res, 200, { ok: true, prs });
      } catch (e) {
        return json(res, 200, { ok: false, error: e.message });
      }
    }

    if (action === "createIssue") {
      const repo = process.env.GITHUB_REPO || "messyandmagnetic/mags-assistant";
      if (!process.env.GITHUB_TOKEN) {
        return json(res, 200, { ok: false, error: "missing token" });
      }
      try {
        const r = await fetch(`https://api.github.com/repos/${repo}/issues`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          },
          body: JSON.stringify({
            title: params.title || "(no title)",
            body: params.body || "",
          }),
        });
        const data = await r.json();
        return json(res, 200, {
          ok: true,
          issue: { number: data.number, url: data.html_url },
        });
      } catch (e) {
        return json(res, 200, { ok: false, error: e.message });
      }
    }

    if (action === "healthBundle" || action === "summarizeStatus") {
      try {
        const [hello, health, diag] = await Promise.all([
          fetch(baseUrl + "/api/hello").then((r) => r.json()).catch(() => ({ ok: false })),
          fetch(baseUrl + "/api/rpa/health").then((r) => r.json()).catch(() => ({ ok: false })),
          fetch(baseUrl + "/api/rpa/diag").then((r) => r.json()).catch(() => ({ ok: false })),
        ]);
        if (action === "summarizeStatus") {
          return json(res, 200, { ok: true, summary: { hello, health, diag } });
        }
        return json(res, 200, { ok: true, hello, health, diag });
      } catch (e) {
        return json(res, 200, { ok: false, error: e.message });
      }
    }

    if (action === "createVideoTask") {
      try {
        const r = await fetch(baseUrl + "/api/video/edit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params || {}),
        });
        const data = await r.json();
        return json(res, 200, data);
      } catch (e) {
        return json(res, 200, { ok: false, error: e.message });
      }
    }

    if (action === "trendsToday") {
      try {
        const r = await fetch(baseUrl + "/api/trends/digest?when=today");
        const data = await r.json();
        return json(res, 200, data);
      } catch (e) {
        return json(res, 200, { ok: false, error: e.message });
      }
    }

    if (action === "createProject") {
      return json(res, 200, { ok: true, project: { title: params.title || "" } });
    }

    if (action === "scheduleDraft") {
      try {
        const r = await fetch(baseUrl + "/api/social/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ when: params.when }),
        });
        const data = await r.json();
        return json(res, 200, data);
      } catch (e) {
        return json(res, 200, { ok: false, error: e.message });
      }
    }

    if (action === "replyPlan") {
      try {
        const r = await fetch(baseUrl + `/api/social/comments/plan?postId=${encodeURIComponent(params.postId || "")}`);
        const data = await r.json();
        return json(res, 200, data);
      } catch (e) {
        return json(res, 200, { ok: false, error: e.message });
      }
    }

    if (action === "scanTrendsNow") {
      try {
        const r = await fetch(baseUrl + "/api/trends/refresh", { method: "POST" });
        const data = await r.json();
        return json(res, 200, data);
      } catch (e) {
        return json(res, 200, { ok: false, error: e.message });
      }
    }

    if (action === "fallbackNow") {
      try {
        const r = await fetch(baseUrl + "/api/social/fallback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params || {}),
        });
        const data = await r.json();
        return json(res, 200, data);
      } catch (e) {
        return json(res, 200, { ok: false, error: e.message });
      }
    }

    return json(res, 400, { ok: false, error: "Unknown action" });
  } catch (err) {
    return json(res, 500, { ok: false, error: err.message || "Internal error" });
  }
}
