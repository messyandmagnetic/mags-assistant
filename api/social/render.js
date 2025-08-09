import { cors, ok, fail, withLogging } from "../../lib/http.js";
import { checkSafety } from "../../lib/safety.js";

export const config = { runtime: "nodejs" };

export default withLogging(async function handler(req, res, requestId) {
  if (cors(req, res)) return;
  if (req.method !== "POST")
    return fail(res, 405, "Method not allowed", { id: requestId });
  try {
    const body = req.body || {};
    const warnings = checkSafety(body.caption || "");
    const previewUrl = `https://example.com/preview/${Math.random()
      .toString(36)
      .slice(2, 8)}.mp4`;
    ok(res, { previewUrl, warnings });
  } catch (err) {
    fail(res, 500, err.message || "Internal error", { id: requestId });
  }
});
