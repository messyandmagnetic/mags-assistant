import { cors, ok, fail, withLogging, rateLimit } from "../../lib/http.js";

export const config = { runtime: "nodejs" };

export default withLogging(function handler(req, res, requestId) {
  if (cors(req, res)) return;
  if (req.method !== "GET")
    return fail(res, 405, "Method not allowed", { id: requestId });
  if (rateLimit(req))
    return fail(res, 429, "Too many requests", { id: requestId });
  try {
    ok(res);
  } catch (err) {
    fail(res, 500, err.message || "Internal error", { id: requestId });
  }
});
