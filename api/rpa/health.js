import { ok } from "../_util.js";
export default function handler(req, res) { ok(res, { status: 200 }); }
export const config = { runtime: "nodejs20.x" };
