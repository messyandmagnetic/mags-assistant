import { cors, ok, fail, withLogging } from "../lib/http.js";

export const config = { runtime: "nodejs" };

export default withLogging(function handler(req, res, requestId) {
  cors(req, res);
  if (req.method !== "GET")
    return fail(res, 405, "Method not allowed", { id: requestId });
  try {
    ok(res, { hello: "mags" });
  } catch (err) {
    fail(res, 500, err.message || "Internal error", { id: requestId });
  }
});
