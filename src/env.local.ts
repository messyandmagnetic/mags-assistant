import fetch from 'node-fetch';

export const localEnv: Record<string, string | undefined> = {
  TELEGRAM_BOT_TOKEN: undefined,
  TELEGRAM_CHAT_ID: undefined,
  SHEET_ID: undefined,
  DRIVE_FOLDER_ID: undefined,
  DRIVE_FINAL_FOLDER_ID: undefined,
  BROWSERLESS_URL: undefined,
  MAKE_FALLBACK_WEBHOOK: undefined,
  RETRY_DELAY_MS: undefined,
  CAPCUT: undefined,
  CLOUDFLARE_WORKER_URL: 'https://tight-snow-2840.messyandmagnetic.workers.dev',
  CLOUDFLARE_WORKER_NAME: 'tight-snow-2840',
};

const cloudKV = {
  async get(key: string): Promise<string | undefined> {
    try {
      const account = process.env.CLOUDFLARE_ACCOUNT_ID;
      const namespace = process.env.CLOUDFLARE_NAMESPACE_ID;
      const token = process.env.CLOUDFLARE_API_TOKEN;
      if (!account || !namespace || !token) return undefined;
      const url = `https://api.cloudflare.com/client/v4/accounts/${account}/storage/kv/namespaces/${namespace}/values/${key}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return undefined;
      return await res.text();
    } catch {
      return undefined;
    }
  },
};

export async function getEnv(key: string): Promise<string | undefined> {
  return (
    process.env[key] ||
    localEnv[key] ||
    (await cloudKV.get(key))
  );
}
