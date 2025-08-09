import { ok } from "./_util.js";
export default function handler(req, res) { ok(res, { hello: "mags" }); }
export const config = { runtime: "nodejs20.x" };
