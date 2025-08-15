import { getConfiguredProviders, getProvider } from "../../../lib/social/index.js";
import { google } from "googleapis";
import fs from "fs";
import path from "path";
import { createEmotionalRemixes } from "../../../lib/social/emotionalRemix.js";
import { runBoosterSequence } from "../../../lib/social/booster.js";

export function tiktokEnabled() {
  return !!(
    process.env.TIKTOK_ACCESS_TOKEN &&
    (process.env.TIKTOK_APP_ID || process.env.TIKTOK_CLIENT_KEY) &&
    (process.env.TIKTOK_APP_SECRET || process.env.TIKTOK_CLIENT_SECRET)
  );
}

export async function scheduleClip() {
  const packPath = path.resolve("public/schedule-pack.json");
  let pack: any = { queue: [] };
  try {
    pack = JSON.parse(fs.readFileSync(packPath, "utf8"));
  } catch {}
  const queue: any[] = pack.queue || [];
  if (queue.length === 0) return { ok: true, scheduled: false };

  const lastSource = pack.lastSourceId;
  const next = queue.find((q) => !q.scheduled && q.sourceId !== lastSource);
  if (!next) return { ok: true, scheduled: false };

  const remixes = createEmotionalRemixes(next.sourceId);
  const now = Date.now();
  remixes.forEach((r, i) => (r.scheduledTime = now + i * 86400000));
  next.remixes = remixes;
  next.scheduledTime = remixes[0].scheduledTime;
  next.scheduled = true;
  pack.lastSourceId = next.sourceId;

  const booster = await runBoosterSequence({
    postId: next.id,
    url: next.url || "",
    caption: next.caption,
  });
  next.booster = { ...booster, done: booster.liked && booster.commented };

  fs.writeFileSync(packPath, JSON.stringify(pack, null, 2));
  return { ok: true, scheduled: true };
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

export async function generateDraftsFromDrive() {
  const folderId = process.env.DRIVE_INBOX_FOLDER_ID;
  if (!folderId) {
    return { ok: false, msg: "missing_drive_folder" };
  }
  try {
    const auth = new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });
    const client = await auth.getClient();
    const drive = google.drive({ version: "v3", auth: client });
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "files(id, name, mimeType, createdTime)",
    });
    const files = res.data.files || [];
    // Placeholder: later create 1-3 drafts, captions, and send approvals
    return { ok: true, items: files.length };
  } catch (err) {
    console.error("[social:drive]", err);
    return { ok: false, msg: "drive_error" };
  }
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
