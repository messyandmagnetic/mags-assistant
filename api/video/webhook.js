import { cors, json } from "../../lib/http.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  try {
    if (cors(req, res)) return;
    if (req.method !== "POST") {
      return json(res, 405, { ok: false, error: "Method not allowed" });
    }
    const body = req.body && typeof req.body === "object" ? req.body : {};
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const id = body.id || Math.random().toString(36).slice(2, 8);
        const url = `https://blob.vercel-storage.com/upload?token=${process.env.BLOB_READ_WRITE_TOKEN}&pathname=video-jobs/${id}.json`;
        await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch (e) {
        console.warn("blob upload failed", e);
      }
    }
    return json(res, 200, { ok: true });
  } catch (err) {
    return json(res, 500, { ok: false, error: err.message || "Internal error" });
  }
}
