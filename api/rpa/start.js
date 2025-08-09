import { allowCors, ok, fail } from "../_util.js";

export default async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (req.method !== "POST") return fail(res, 405, "Method Not Allowed");

  let url;
  try { ({ url } = req.body || {}); } catch { /* form/malformed */ }
  if (!url || typeof url !== "string") return fail(res, 400, "Missing 'url'");

  try {
    // If Browserless key is available, call it; otherwise simulate success.
    if (process.env.BROWSERLESS_API_KEY) {
      // TODO: fetch to Browserless with the URL; return parsed result
      // Keep the code resilient—timeouts and non-200s return fail(...).
    }
    return ok(res, { started: true, target: url });
  } catch (e) {
    return fail(res, 502, "RPA start failed", { detail: String(e) });
  }
}
export const config = { runtime: "nodejs20.x" };
