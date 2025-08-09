import crypto from "node:crypto";

export function json(res, code, body) {
  res.setHeader("Content-Type", "application/json");
  res.status(code).end(JSON.stringify(body));
}

export function cors(req, res) {
  const allowed = process.env.ALLOWED_ORIGINS || "*";
  if (allowed === "*") {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else {
    const origin = req.headers.origin || "";
    const list = allowed.split(",").map((s) => s.trim());
    if (origin && list.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    } else {
      res.setHeader("Access-Control-Allow-Origin", list[0] || "*");
    }
  }
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return true;
  }
  return false;
}

export const ok = (res, body = {}) => {
  const status = 200;
  json(res, status, { ok: true, status, ...body });
};

export const fail = (res, code = 500, message = "Internal error", extra = {}) => {
  const status = code;
  json(res, code, { ok: false, status, message, ...extra });
};

export function withLogging(handler) {
  return async (req, res) => {
    const start = Date.now();
    const requestId = crypto.randomUUID();
    res.setHeader("X-Request-ID", requestId);
    try {
      await handler(req, res, requestId);
    } finally {
      const durationMs = Date.now() - start;
      const status = res.statusCode || 200;
      console.log(
        JSON.stringify({ route: req.url, status, requestId, durationMs })
      );
    }
  };
}

const rateState = new Map();
export function rateLimit(req, limit = 20) {
  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket.remoteAddress ||
    "0";
  const now = Date.now();
  const rec = rateState.get(ip) || { count: 0, ts: now };
  if (now - rec.ts > 60000) {
    rec.count = 0;
    rec.ts = now;
  }
  rec.count += 1;
  rateState.set(ip, rec);
  return rec.count > limit;
}
