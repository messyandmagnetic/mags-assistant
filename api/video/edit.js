import { cors, json } from "../../lib/http.js";

export const config = { runtime: "nodejs" };

const overlayMap = {
  sparkles: process.env.OVERLAY_SPARKLES_URL,
  flowers: process.env.OVERLAY_FLOWERS_URL,
  leaf: process.env.OVERLAY_LEAF_URL,
  feather: process.env.OVERLAY_FEATHER_URL,
  teacup: process.env.OVERLAY_TEACUP_URL,
};

export default async function handler(req, res) {
  try {
    if (cors(req, res)) return;
    if (req.method !== "POST") {
      return json(res, 405, { ok: false, error: "Method not allowed" });
    }
    const params = req.body && typeof req.body === "object" ? req.body : {};
    const theme = params.theme || "pastel-script";
    const ar916 = params.ar916 !== false;
    const ar11 = !!params.ar11;
    const overlayNames = Array.isArray(params.overlays)
      ? params.overlays
      : typeof params.overlays === "string"
      ? [params.overlays]
      : [];
    const overlays = overlayNames.map((n) => overlayMap[n]).filter(Boolean);
    const jobs = [];
    const baseId = Math.random().toString(36).slice(2, 8);
    const makeJob = (ratio) => ({
      id: `${baseId}-${ratio.replace(/\W/g, '')}`,
      ratio,
      theme,
      overlays,
      watermark: process.env.BRAND_WATERMARK_URL || null,
    });
    if (ar916) jobs.push(makeJob("9:16"));
    if (ar11) jobs.push(makeJob("1:1"));
    return json(res, 200, { ok: true, jobs });
  } catch (err) {
    return json(res, 500, { ok: false, error: err.message || "Internal error" });
  }
}
