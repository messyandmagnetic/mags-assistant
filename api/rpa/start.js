import { cors, ok, fail } from "../../lib/http.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") return fail(res, 405, "Method not allowed");
  try {
    const { url } = req.body || {};
    if (!url || typeof url !== "string") return fail(res, 400, "Missing 'url'");

    if (process.env.BROWSERLESS_API_KEY) {
      // Intended Browserless call would go here using the API key and URL.
      // await fetch(...);
    }

    ok(res, { started: true });
  } catch (err) {
    console.error(err);
    fail(res, 500, err.message || "Internal error");
  }
}
