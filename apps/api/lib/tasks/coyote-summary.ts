import { notion } from "../notion";
import { getDrive } from "../../../lib/google.js";
import type { TaskResult } from "./index";

function buildSummary() {
  const today = new Date().toISOString().slice(0, 10);
  const title = `Mags — Coyote Commons Acquisition Summary (${today})`;
  const content = `OVERVIEW:\nI am Mags, Chanel’s automation agent, running the full Coyote Commons Acquisition Master Prompt. My mission is to secure the 20-acre Coyote property (Rio Arriba County, NM) primarily through donations, and secondarily through nonprofit-friendly lending if necessary. I act as Chanel in voice and intent.\n\nKEY FUNCTIONS:\n- Stripe Integration: Create/audit donation products, ensure payment links work, harvest URLs, keep Notion donor page updated.\n- Notion Integration: Maintain donor page, tracker database, synced live progress, and top lead lists.\n- Google Sheets Integration: Mirror tracker, activity log, budget, and rollups between Notion & Sheets.\n- Gmail Integration: Scan for relevant emails (label land fund), classify leads, summarize, log, and follow up.\n- Telegram Integration: Send daily digest of replies, new leads, follow-ups due, and blockers.\n- Prospecting: Weekly search for new donors, DAFs, foundations, lenders, and partners using predefined queries.\n- Collateral Generation: Automatically create/update/send One-Pager PDF, Budget PDF, Seller Letter, Impact Metrics Sheet, Impact Snapshot, and Donor Pitch Script at the correct lead stage.\n- Auto-Triggers: Send one-pager when donor/foundation lead → Warm; send budget PDF when requested; send seller letter when property stage ≥ Offer Prep; refresh metrics weekly or on major pledge jumps.\n\nSCHEDULE:\n- Stripe audit & payment link harvest: 08:30 daily\n- Stripe payments poll: 08:35 daily\n- Gmail scan & tracker update: 09:00 daily\n- Prospecting: Mondays 10:00\n- Follow-up cycle: every 7–10 days\n- Telegram digest: 18:00 daily\n- Metrics update: weekly Monday or on $10k+ pledges\n- Summary update: every 30 days or prompt change >5%\n\nHOW TO USE ME:\n- FEED ME: New contacts, donor names, lender names, updates to property info, new grant/DAF opportunities, Stripe product changes.\n- I DO AUTOMATICALLY: Outreach to new leads, follow-ups on schedule, tracker updates, collateral generation/sending, Notion & Drive sync, Stripe audits, donor page maintenance.\n- I ASK APPROVAL FOR: Sensitive email replies to high-priority donors, grant application submissions, lender term acceptances, and publishing new public-facing copy.\n- I REPORT VIA: Daily Telegram digest, Notion “Live Progress” updates, and Activity Log entries in Sheets/Notion.\n\nCOLLATERAL I MAINTAIN:\n- One-Pager PDF (auto-updated with Stripe links, budget, program info)\n- Budget Snapshot PDF\n- Seller Letter (auto-sent at property offer stage)\n- Impact Metrics Sheet (auto-refreshed weekly)\n- Impact Story Bank\n- Donor Pitch Script\n- Quarterly Impact Snapshot PDF`;
  return { title, content };
}

export async function updateCoyoteSummary(): Promise<TaskResult> {
  const { title, content } = buildSummary();
  let notionLink = "";
  let driveLink = "";
  try {
    // Notion storage
    const parentId = process.env.COYOTE_NOTION_PAGE_ID;
    if (process.env.NOTION_TOKEN && parentId) {
      const blocks = content.split("\n\n").map((p) => ({
        paragraph: { rich_text: [{ text: { content: p } }] },
      }));
      const page = await notion.pages.create({
        parent: { page_id: parentId },
        properties: { title: { title: [{ text: { content: title } }] } },
        children: blocks,
      });
      notionLink = (page as any).url || "";
      const children = await notion.blocks.children.list({ block_id: parentId });
      const summaries = children.results.filter(
        (b: any) => b.type === "child_page" && b.child_page?.title.startsWith("Mags — Coyote Commons Acquisition Summary")
      );
      summaries
        .sort((a: any, b: any) => (a.created_time < b.created_time ? 1 : -1))
        .slice(3)
        .forEach((old: any) => notion.pages.update({ page_id: old.id, archived: true }));
    }
    // Google Drive storage
    const driveFolder = process.env.COYOTE_DRIVE_FOLDER_ID;
    if (process.env.GOOGLE_CLIENT_EMAIL && driveFolder) {
      const drive = await getDrive();
      const file = await drive.files.create({
        requestBody: {
          name: title,
          parents: [driveFolder],
          mimeType: "application/vnd.google-apps.document",
        },
        media: { mimeType: "text/plain", body: content },
        fields: "id, webViewLink, name, createdTime",
      });
      driveLink = file.data.webViewLink || "";
      const list = await drive.files.list({
        q: `'${driveFolder}' in parents and trashed = false and name contains 'Mags — Coyote Commons Acquisition Summary'`,
        fields: "files(id, name, createdTime)",
        orderBy: "createdTime desc",
      });
      const files = list.data.files || [];
      for (const f of files.slice(3)) {
        await drive.files.delete({ fileId: f.id });
      }
    }
    // Telegram notification
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      const text = `Summary updated\nDate: ${new Date().toLocaleString()}\nNotion: ${notionLink}\nDrive: ${driveLink}`;
      await fetch(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text }),
        }
      );
    }
    return { name: "coyote.summary", ok: true, msg: "updated" };
  } catch (err: any) {
    return { name: "coyote.summary", ok: false, msg: err?.message || String(err) };
  }
}

export default updateCoyoteSummary;
