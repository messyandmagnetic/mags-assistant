import { cors, json } from "../../lib/http.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  try {
    if (cors(req, res)) return;
    if (req.method !== "GET") {
      return json(res, 405, { ok: false, error: "Method not allowed" });
    }
    const ideas = [
      {
        id: "stub-1",
        title: "Share a wholesome moment",
        actionCard: "## Idea\nCapture a cozy scene and share why it matters."
      }
    ];
    return json(res, 200, { ok: true, ideas });
  } catch (err) {
    return json(res, 500, { ok: false, error: err.message || "Internal error" });
  }
}
