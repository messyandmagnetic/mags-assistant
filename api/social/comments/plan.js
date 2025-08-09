import { cors, json } from "../../../lib/http.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  try {
    if (cors(req, res)) return;
    if (req.method !== "GET") {
      return json(res, 405, { ok: false, error: "Method not allowed" });
    }
    const url = new URL(req.url, `http://${req.headers.host}`);
    const postId = url.searchParams.get("postId") || "";
    const plan = {
      postId,
      comments: [
        { id: "c1", text: "Great post!" }
      ],
      suggestions: [
        { commentId: "c1", text: "Thanks for sharing!", confidence: 0.9 }
      ]
    };
    return json(res, 200, { ok: true, plan });
  } catch (err) {
    return json(res, 500, { ok: false, error: err.message || "Internal error" });
  }
}
