export async function refreshSocialPlanner() {
  // Placeholder: later read a Notion database or Google Sheet for content ideas
  // For now just report a heartbeat to prove scheduler runs.
  return { name: "social.refresh_planner", ok: true, msg: "heartbeat" };
}
