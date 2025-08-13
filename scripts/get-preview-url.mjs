import { writeFileSync } from 'node:fs';

const { VERCEL_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID } = process.env;

async function main() {
  try {
    if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
      // No secrets? Just exit quietly — caller will fall back to prod
      return;
    }
    const team = VERCEL_TEAM_ID ? `&teamId=${encodeURIComponent(VERCEL_TEAM_ID)}` : '';
    const url = `https://api.vercel.com/v6/deployments?projectId=${encodeURIComponent(VERCEL_PROJECT_ID)}${team}&state=READY&limit=1`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } });
    if (!res.ok) return;

    const data = await res.json();
    const dep = data?.deployments?.[0];
    if (dep?.url) {
      const full = `https://${dep.url}`;
      writeFileSync('preview_url.txt', full, 'utf8');
      console.log(full);
    }
  } catch (e) {
    // Don’t throw in CI; fallback will handle it.
  }
}
main();
