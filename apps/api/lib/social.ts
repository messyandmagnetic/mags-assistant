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

export async function postDueClips() {
  if (!tiktokEnabled()) {
    // Export-only mode; nothing posted.
    return { ok: true, posted: 0, exportOnly: true };
  }
  // Stub implementation; real TikTok posting would go here.
  return { ok: true, posted: 0 };
}
