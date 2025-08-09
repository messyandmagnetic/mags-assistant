import { cors, json } from "../../lib/http.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  try {
    if (cors(req, res)) return;
    if (req.method !== "POST") {
      return json(res, 405, { ok: false, error: "Method not allowed" });
    }
    return json(res, 200, { ok: true, scheduleId: Math.random().toString(36).slice(2, 8) });
  } catch (err) {
    return json(res, 500, { ok: false, error: err.message || "Internal error" });
  }
}
