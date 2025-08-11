import { getConfiguredProviders, getProvider } from "../../../lib/social/index.js";

export function tiktokEnabled() {
  return !!(
    process.env.TIKTOK_ACCESS_TOKEN &&
    process.env.TIKTOK_CLIENT_KEY &&
    process.env.TIKTOK_CLIENT_SECRET
  );
}

export async function scheduleClip() {
  // Stub: scheduling logic would choose optimal time and update Notion.
  return { ok: true, scheduled: false };
}

export async function crossPostClip(params: {
  caption?: string;
  mediaUrl?: string;
  linkUrl?: string;
}) {
  const cfg = getConfiguredProviders();
  let posted = 0;
  for (const [name, enabled] of Object.entries(cfg)) {
    if (!enabled) continue;
    const post = getProvider(name);
    if (typeof post === "function") {
      try {
        await post(params);
        posted++;
      } catch (err) {
        console.error(`[social:${name}]`, err);
      }
    }
  }
  return { ok: true, posted };
}

export async function collectSocialInbox() {
  // Placeholder: would pull comments and DMs from all providers
  return { ok: true, items: 0 };
}

export async function refreshAnalytics() {
  // Placeholder: would fetch analytics and compute best post times
  return { ok: true, updated: false };
}

export async function postDueClips() {
  const cfg = getConfiguredProviders();
  const anyEnabled = Object.values(cfg).some(Boolean);
  if (!anyEnabled) {
    // Export-only mode; nothing posted.
    return { ok: true, posted: 0, exportOnly: true };
  }
  const res = await crossPostClip({});
  return { ok: true, posted: res.posted };
}
