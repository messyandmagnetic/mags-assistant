import axios from 'axios';
import { google } from 'googleapis';
import { readSoulBlueprint } from './soul-utils';
import { suggestMagnetIcons } from './magnet-utils';

/** Fetch top trending audio links from TikTok web. */
export async function fetchTrendingAudios(): Promise<string[]> {
  const res = await axios.get('https://trends.tiktok.com/sounds');
  const ids = extractSoundIDs(res.data);
  return ids.slice(0, 10);
}

/** Parse TikTok sound IDs from HTML. */
function extractSoundIDs(html: string): string[] {
  const regex = /music\/(\w+[^?]*)\?/g;
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    results.push(`https://www.tiktok.com/music/${match[1]}`);
  }
  return results;
}

/** Generate a simple validating comment/reply pair for a TikTok post. */
export async function generateComments(emotion: string): Promise<{ comment: string; reply: string }> {
  const tone = emotion || 'validating';
  const comment = `When you feel like this... \u{1F4AD} (${tone})`;
  const reply = 'Exactly why we made this one. \u{1F9E0}\u{1F33F}';
  return { comment, reply };
}

/** Append performance analytics to a Google Sheet. */
export async function appendAnalytics(
  videoId: string,
  stats: { likes: number; views: number; shares: number; comments: number }
) {
  const sheets = google.sheets('v4');
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SHEET_ID!,
    range: 'Analytics!A1',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[new Date().toISOString(), videoId, stats.likes, stats.views, stats.shares, stats.comments]],
    },
  });
}

/** Suggest magnet icons based on a user's soul blueprint keywords. */
export async function matchSoulToMagnets(userId: string) {
  const blueprint = await readSoulBlueprint(userId);
  const keywords = blueprint.themes
    .concat(blueprint.elements)
    .concat(blueprint.astro.sunSign);
  return suggestMagnetIcons(keywords);
}

