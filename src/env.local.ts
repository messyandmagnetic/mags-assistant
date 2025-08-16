import type { KVNamespace } from '@cloudflare/workers-types';

export async function getEnv(key: string, env?: { POST_QUEUE?: KVNamespace }): Promise<string | undefined> {
  const val = process.env[key];
  if (val !== undefined) return val;
  if (env?.POST_QUEUE) {
    try {
      const v = await env.POST_QUEUE.get(key);
      if (v !== null) return v;
    } catch {
      // ignore and fall through
    }
  }
  return undefined;
}
