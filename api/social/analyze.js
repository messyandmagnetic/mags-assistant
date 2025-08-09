import { cors, ok, fail, withLogging } from "../../lib/http.js";
import { checkSafety } from "../../lib/safety.js";

export const config = { runtime: "nodejs" };

export default withLogging(async function handler(req, res, requestId) {
  if (cors(req, res)) return;
  if (req.method !== "POST")
    return fail(res, 405, "Method not allowed", { id: requestId });
  try {
    const body = req.body || {};
    const text = body.url || "";
    const warnings = checkSafety(text);
    const moments = [
      { start: 5, end: 10, reason: "energy spike" },
      { start: 30, end: 35, reason: "smile detected" },
    ];
    ok(res, { moments, warnings });
  } catch (err) {
    fail(res, 500, err.message || "Internal error", { id: requestId });
  }
});
