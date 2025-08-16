import fetch from 'node-fetch';

export const localEnv: Record<string, string | undefined> = {
  TELEGRAM_BOT_TOKEN: 'YOUR_TELEGRAM_BOT_TOKEN',
  TELEGRAM_CHAT_ID: 'YOUR_TELEGRAM_CHAT_ID',
  SHEET_ID: 'YOUR_GOOGLE_SHEET_ID',
  DRIVE_FOLDER_ID: 'YOUR_DRIVE_RAW_ID',
  DRIVE_FINAL_FOLDER_ID: 'YOUR_DRIVE_DONE_ID',
  BROWSERLESS_URL: 'YOUR_BROWSERLESS_URL',
  MAKE_FALLBACK_WEBHOOK: 'YOUR_MAKE_WEBHOOK',
  CLOUDFLARE_KV_ACCOUNT_ID: 'YOUR_CF_ACCOUNT_ID',
  CLOUDFLARE_KV_NAMESPACE_ID: 'YOUR_KV_NAMESPACE',
  CLOUDFLARE_API_TOKEN: 'YOUR_API_TOKEN',
};

const cloudKV = {
  async get(key: string): Promise<string | undefined> {
    try {
      const account = process.env.CLOUDFLARE_KV_ACCOUNT_ID || localEnv.CLOUDFLARE_KV_ACCOUNT_ID;
      const namespace = process.env.CLOUDFLARE_KV_NAMESPACE_ID || localEnv.CLOUDFLARE_KV_NAMESPACE_ID;
      const token = process.env.CLOUDFLARE_API_TOKEN || localEnv.CLOUDFLARE_API_TOKEN;
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
