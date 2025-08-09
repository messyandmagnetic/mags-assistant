import { cors, ok, fail, json } from "../lib/http.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  console.log(`${req.method} ${req.url}`);
  try {
    if (cors(req, res)) return;
    const { pathname } = new URL(req.url, `http://${req.headers.host}`);
    const route = `${req.method} ${pathname}`;
    switch (route) {
      case "GET /api/hello":
        return ok(res);
      case "HEAD /api/rpa/health":
        res.status(200).end();
        return;
      case "GET /api/rpa/health":
        return ok(res, { status: 200 });
      case "GET /api/rpa/diag": {
        const baseUrl = `https://${req.headers.host}`;
        const haveKeys = {
          openai: Boolean(process.env.OPENAI_API_KEY),
          shotstack: Boolean(process.env.SHOTSTACK_API_KEY),
          blob: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
        };
        return ok(res, { baseUrl, haveKeys });
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
      case "GET /api/rpa/start":
      case "HEAD /api/rpa/start":
        return json(res, 405, {
          ok: false,
          code: "METHOD_NOT_ALLOWED",
          message: "Method not allowed",
        });
      default:
        return fail(res, 404, "Not found");
    }
  } catch (err) {
    console.error(err);
    return fail(res, 500, err.message || "Internal error");
  }
}
