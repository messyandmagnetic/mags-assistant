import { cors, ok, fail } from "../lib/http.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  console.log(`${req.method} ${req.url}`);
  if (cors(req, res)) return;
  const url = new URL(req.url, `http://${req.headers.host}`);
  const op = url.searchParams.get("op");
  try {
    if (op === "bootstrap") {
      if (req.method !== "POST") return fail(res, 405, "Method not allowed");
      return ok(res, { status: "bootstrapped" });
    }
    if (op === "health") {
      if (req.method === "HEAD") return res.status(200).end();
      if (req.method !== "GET") return fail(res, 405, "Method not allowed");
      return ok(res, { status: 200 });
    }
    if (op === "run-command") {
      if (req.method !== "POST") return fail(res, 405, "Method not allowed");
      const { command } = req.body || {};
      if (!command) return fail(res, 400, "Missing command");
      if (String(command).toLowerCase().includes("hello")) {
        return ok(res, { message: "Hello to you too!" });
      }
      return ok(res, { message: `Command not recognized: ${command}` });
    }
    if (op === "syncstripe") {
      if (req.method !== "POST") return fail(res, 405, "Method not allowed");
      return ok(res, { status: "synced" });
    }
    return fail(res, 400, "Unknown op");
  } catch (err) {
    console.error(err);
    return fail(res, 500, err.message || "Internal error");
  }
}
