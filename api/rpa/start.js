import { cors, json } from "../../lib/http.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  console.log(`${req.method} ${req.url}`);
  try {
    if (cors(req, res)) return;
    if (req.method !== "POST") {
      return json(res, 405, {
        ok: false,
        code: "METHOD_NOT_ALLOWED",
        message: "Method not allowed",
      });
    }

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const url = typeof body.url === "string" ? body.url.trim() : "";
    try {
      if (!url) throw new Error("missing");
      new URL(url);
    } catch {
      return json(res, 400, {
        ok: false,
        code: "BAD_REQUEST",
        message: "'url' is required",
      });
    }

    // Placeholder for future work kick-off
    if (process.env.BROWSERLESS_API_KEY) {
      // await fetch(...)
    }

    return json(res, 200, { ok: true, started: true, url });
  } catch (err) {
    const id = Math.random().toString(36).slice(2, 8);
    console.error(id, err);
    return json(res, 500, { ok: false, code: "INTERNAL_ERROR", id });
  }
}
