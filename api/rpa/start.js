import { cors, ok, fail, json, withLogging, rateLimit } from "../../lib/http.js";

export const config = { runtime: "nodejs" };

export default withLogging(async function handler(req, res, requestId) {
  if (cors(req, res)) return;
  if (req.method !== "POST")
    return fail(res, 405, "Method not allowed", { id: requestId });
  if (rateLimit(req))
    return fail(res, 429, "Too many requests", { id: requestId });
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const url = typeof body.url === "string" ? body.url.trim() : "";
    try {
      if (!url) throw new Error("missing");
      const u = new URL(url);
      if (u.protocol !== "https:") throw new Error("https required");
    } catch {
      return json(res, 200, {
        ok: false,
        status: 400,
        message: "'url' must be https",
        id: requestId,
      });
    }

    const jobId = Math.random().toString(36).slice(2, 10);
    return ok(res, { jobId });
  } catch (err) {
    return fail(res, 500, err.message || "Internal error", { id: requestId });
  }
});
