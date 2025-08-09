import fs from "node:fs/promises";
import { cors, ok, fail, withLogging } from "../../lib/http.js";
import { checkSafety } from "../../lib/safety.js";

const DATA_FILE = new URL("../../data/schedule.json", import.meta.url);

export const config = { runtime: "nodejs" };

export default withLogging(async function handler(req, res, requestId) {
  if (cors(req, res)) return;
  if (req.method !== "POST")
    return fail(res, 405, "Method not allowed", { id: requestId });
  try {
    const body = req.body || {};
    const warnings = checkSafety(body.caption || "");
    const job = {
      id: Date.now().toString(36),
      ...body,
      warnings,
    };
    const raw = await fs.readFile(DATA_FILE, "utf8").catch(() => "[]");
    const list = JSON.parse(raw);
    list.push(job);
    await fs.writeFile(DATA_FILE, JSON.stringify(list, null, 2));
    ok(res, { job });
  } catch (err) {
    fail(res, 500, err.message || "Internal error", { id: requestId });
  }
});
