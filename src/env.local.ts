import fetch from 'node-fetch';

export const localEnv: Record<string, string | undefined> = {};

/**
 * getEnv prefers runtime vars, then process.env, then localEnv.
 * If not found, it optionally fetches from a remote KV store.
 */
export async function getEnv(key: string, env: Record<string, string | undefined> = {}): Promise<string | undefined> {
  if (env[key]) return env[key];
  if (process.env[key]) return process.env[key];
  if (localEnv[key]) return localEnv[key];

  const kv = process.env.CLOUDFLARE_KV_URL || process.env.CODEX_KV_URL;
  if (kv) {
    try {
      const res = await fetch(`${kv}/${key}`);
      if (res.ok) {
        const data = await res.json().catch(() => undefined);
        return data?.value || (await res.text());
      }
    } catch (err) {
      console.error('KV fetch failed', err);
    }
  }
  return undefined;
}
