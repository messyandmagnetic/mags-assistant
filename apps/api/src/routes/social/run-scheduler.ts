import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { runTasks } from "../../../lib/tasks";

export const dynamic = "force-dynamic";

function authorized(req: NextRequest) {
  const key = process.env.CRON_SECRET;
  if (!key) return true;
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const header = req.headers.get("x-cron-secret");
  return token === key || header === key;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const tasks = [
    "social.refresh_planner",
    "social.collect_inbox",
    "social.refresh_analytics",
    "social.post_due",
  ];
  const results = await runTasks(tasks);
  const ok = results.every(r => r.ok);
  return NextResponse.json({ ok, ran: results });
}
