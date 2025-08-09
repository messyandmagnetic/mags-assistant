import { cors, json } from "../../lib/http.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  try {
    if (cors(req, res)) return;
    if (req.method !== "GET") {
      return json(res, 405, { ok: false, error: "Method not allowed" });
    }
    const url = new URL(req.url, `http://${req.headers.host}`);
    const ids = url.searchParams.getAll("id");
    const jobs = ids.map((id) => ({ id, status: "queued" }));
    return json(res, 200, { ok: true, jobs });
  } catch (err) {
    return json(res, 500, { ok: false, error: err.message || "Internal error" });
  }
}
