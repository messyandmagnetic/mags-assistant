export function json(res, code, body) {
  res.setHeader("Content-Type", "application/json");
  res.status(code).end(JSON.stringify(body));
}
export function allowCors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") { res.status(200).end(); return true; }
  return false;
}
export const ok = (res, body={}) => json(res, 200, { ok:true, ...body });
export const fail = (res, code=500, msg="Error", extra={}) =>
  json(res, code, { ok:false, status:code, error:msg, ...extra });
