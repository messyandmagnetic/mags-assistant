import { cors, ok, fail } from "../lib/http.js";

export const config = { runtime: "nodejs" };

export default function handler(req, res) {
  console.log(`${req.method} ${req.url}`);
  cors(req, res);
  const route = req.query.route;
  if (route === "health" && req.method === "HEAD") {
    res.status(200).end();
    return;
  }
  if (req.method !== "GET") {
    return fail(res, 405, "Method not allowed");
  }
  try {
    if (route === "hello") {
      return ok(res);
    }
    if (route === "health") {
      return ok(res, { status: 200 });
    }
    if (route === "diag") {
      const baseUrl = `https://${req.headers.host}`;
      const haveKeys = {
        openai: Boolean(process.env.OPENAI_API_KEY),
        shotstack: Boolean(process.env.SHOTSTACK_API_KEY),
        blob: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
      };
      return ok(res, { baseUrl, haveKeys });
    }
    return fail(res, 404, "Not found");
  } catch (err) {
    console.error(err);
    fail(res, 500, err.message || "Internal error");
  }
}
