const required = [
  "FETCH_PASS",
  "NEXT_PUBLIC_FETCH_PASS",
  "STRIPE_WEBHOOK_SECRET",
  "NOTION_TOKEN",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID"
];
const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  console.warn("Missing env vars:", missing);
  process.exitCode = 0; // warn only
} else {
  console.log("All core env vars present.");
}
