import { cors, ok, fail, json } from "../lib/http.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  console.log(`${req.method} ${req.url}`);
  try {
    if (cors(req, res)) return;
    const { pathname } = new URL(req.url, `http://${req.headers.host}`);
    const route = `${req.method} ${pathname}`;

    if (
      (pathname.startsWith("/api/site/") ||
        pathname.startsWith("/api/rpa/") ||
        pathname.startsWith("/api/donors")) &&
      req.headers["x-mags-key"] !== process.env.MAGS_KEY
    ) {
      return fail(res, 401, "Unauthorized");
    }

    switch (route) {
      case "GET /api/hello":
        return ok(res, { ok: true, hello: "mags" });
      case "GET /api/rpa/health":
        return ok(res, { ok: true });
      case "GET /api/rpa/diag": {
        const haveKeys = {
          stripe: Boolean(process.env.STRIPE_SECRET_KEY),
          sheet: Boolean(process.env.SHEET_ID),
          tally: Boolean(process.env.TALLY_SECRET),
          openai: Boolean(process.env.OPENAI_API_KEY),
        };
        return ok(res, { ok: true, haveKeys });
      }
      case "POST /api/rpa/start": {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const url = typeof body.url === "string" ? body.url.trim() : "";
        try {
          if (!url) throw new Error("missing");
          new URL(url);
        } catch {
          return json(res, 200, {
            ok: false,
            code: "BAD_REQUEST",
            message: "'url' is required",
          });
        }
        if (process.env.BROWSERLESS_API_KEY) {
          // await fetch(...)
        }
        return json(res, 200, {
          ok: true,
          started: true,
          url,
          jobId: Math.random().toString(36).slice(2, 8),
        });
      }
      case "GET /api/site/sync":
        return ok(res, { ok: true, created: 0, updated: 0, errors: [] });
      case "POST /api/hook/tally": {
        if (req.headers["x-tally-secret"] !== process.env.TALLY_SECRET) {
          return fail(res, 401, "Unauthorized");
        }
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const row = [new Date().toISOString(), JSON.stringify(body)];
        if (process.env.APPS_SCRIPT_DEPLOYMENT) {
          const qs = new URLSearchParams({ cmd: "add", row: JSON.stringify(row) });
          await fetch(`${process.env.APPS_SCRIPT_DEPLOYMENT}?${qs.toString()}`);
        }
        return ok(res, { ok: true });
      }
      case "GET /api/donors":
        return ok(res, { ok: true, donors: [] });
      default:
        return fail(res, 404, "Not found");
    }
  } catch (err) {
    console.error(err);
    return fail(res, 500, err.message || "Internal error");
  }
}
