import { cors, ok, fail } from "../lib/http.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  console.log(`${req.method} ${req.url}`);
  cors(req, res);
  if (req.method !== "POST") return fail(res, 405, "Method not allowed");
  try {
    console.log("bootstrap triggered");
    ok(res, { status: "bootstrapped" });
  } catch (err) {
    console.error(err);
    fail(res, 500, err.message || "Internal error");
  }
}
