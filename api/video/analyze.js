import { cors, json } from "../../lib/http.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  try {
    if (cors(req, res)) return;
    if (req.method !== "POST") {
      return json(res, 405, { ok: false, error: "Method not allowed" });
    }
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const duration = 5;
    const hooks = [{ start: 0, end: 1, reason: "start" }];
    const safety = [];
    const tone = "funny";
    return json(res, 200, { ok: true, duration, hooks, safety, tone });
  } catch (err) {
    return json(res, 500, { ok: false, error: err.message || "Internal error" });
  }
}
