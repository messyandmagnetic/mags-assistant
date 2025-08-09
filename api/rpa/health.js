import { cors, ok, fail } from "../../lib/http.js";

export const config = { runtime: "nodejs" };

export default function handler(req, res) {
  cors(req, res);
  if (req.method !== "GET") return fail(res, 405, "Method not allowed");
  try {
    ok(res, { status: 200 });
  } catch (err) {
    console.error(err);
    fail(res, 500, err.message || "Internal error");
  }
}
