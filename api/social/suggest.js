import { cors, ok, fail, withLogging } from "../../lib/http.js";
import { checkSafety } from "../../lib/safety.js";

export const config = { runtime: "nodejs" };

export default withLogging(async function handler(req, res, requestId) {
  if (cors(req, res)) return;
  if (req.method !== "POST")
    return fail(res, 405, "Method not allowed", { id: requestId });
  try {
    const body = req.body || {};
    const warnings = checkSafety(body.transcript || "");
    const overlay = `Try a ${body.emotion || "fun"} vibe about ${body.theme || "your topic"}`;
    const captions = [
      "Check this out!",
      "You won't believe this",
      "Daily tip inside",
    ];
    const hashtags = Array.from({ length: 10 }, (_, i) => `#tag${i + 1}`);
    const sounds = ["sound1", "sound2", "sound3"];
    ok(res, {
      overlay,
      captions,
      hashtags,
      sounds,
      warnings,
    });
  } catch (err) {
    fail(res, 500, err.message || "Internal error", { id: requestId });
  }
});
