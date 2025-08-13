export default async function handler(_req: any, res: any) {
  res.status(200).json({ ok: true, service: "mags-assistant", ts: Date.now() });
}
export const config = { runtime: "nodejs" };
