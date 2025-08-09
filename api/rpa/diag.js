import { cors, ok, fail } from "../../lib/http.js";

export const config = { runtime: "nodejs" };

export default function handler(req, res) {
  console.log(`${req.method} ${req.url}`);
  cors(req, res);
  if (req.method !== "GET") return fail(res, 405, "Method not allowed");
  try {
    const baseUrl = `https://${req.headers.host}`;
    const haveKeys = {
      openai: Boolean(process.env.OPENAI_API_KEY),
      shotstack: Boolean(process.env.SHOTSTACK_API_KEY),
      blob: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    };
    ok(res, { baseUrl, haveKeys });
  } catch (err) {
    console.error(err);
    fail(res, 500, err.message || "Internal error");
  }
}
