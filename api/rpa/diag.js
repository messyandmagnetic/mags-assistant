import { cors, ok, fail } from "../../lib/http.js";

export const config = { runtime: "nodejs" };

export default function handler(req, res) {
  console.log(`${req.method} ${req.url}`);
  cors(req, res);
  if (req.method !== "GET") return fail(res, 405, "Method not allowed");
  try {
    const baseUrl = `https://${req.headers.host}`;
    const haveOpenAIKey = Boolean(process.env.OPENAI_API_KEY);
    ok(res, { baseUrl, haveOpenAIKey });
  } catch (err) {
    console.error(err);
    fail(res, 500, err.message || "Internal error");
  }
}
