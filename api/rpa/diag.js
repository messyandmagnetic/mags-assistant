import { ok } from "../_util.js";
export default function handler(req, res) {
  ok(res, {
    baseUrl: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    haveKey: Boolean(process.env.BROWSERLESS_API_KEY || process.env.OPENAI_API_KEY)
  });
}
export const config = { runtime: "nodejs20.x" };
