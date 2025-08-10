// Minimal task runner that stays under Vercel's function limits
import { syncHQ } from "./notion-sync";
import { refreshSocialPlanner } from "./social-planner";
import { sweepReminders } from "./reminders";
import { triageInbox } from "./inbox";

export type TaskResult = { name: string; ok: boolean; msg?: string };
export type TaskFn = () => Promise<TaskResult>;

export const tasks: Record<string, TaskFn> = {
  "notion.sync_hq": syncHQ,
  "social.refresh_planner": refreshSocialPlanner,
  "ops.sweep_reminders": sweepReminders,
  "ops.triage_inbox": triageInbox,
};

const taskFlags: Record<string, string> = {
  "notion.sync_hq": "TASK_NOTION_SYNC",
  "social.refresh_planner": "TASK_SOCIAL_REFRESH",
  "ops.sweep_reminders": "TASK_REMINDERS_SWEEP",
  "ops.triage_inbox": "TASK_INBOX_TRIAGE",
};

export async function runTasks(selected?: string[]) {
  const names = selected?.length ? selected : Object.keys(tasks);
  const results: TaskResult[] = [];
  for (const name of names) {
    const flag = taskFlags[name];
    if (flag && process.env[flag] === "0") {
      results.push({ name, ok: true, msg: "skipped" });
      continue;
    }
    try {
      const res = await tasks[name]();
      results.push(res ?? { name, ok: true });
    } catch (err: any) {
      results.push({ name, ok: false, msg: err?.message || String(err) });
    }
  }
  return results;
}
