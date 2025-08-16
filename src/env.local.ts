// Local defaults for development or fallback when process.env is missing.
// Move non-sensitive values to Cloudflare KV or Codex Key Vault in production.
export const localEnv: Record<string, string | undefined> = {
  TELEGRAM_BOT_TOKEN: undefined,
  TELEGRAM_CHAT_ID: undefined,
  SHEET_ID: undefined,
  DRIVE_FOLDER_ID: undefined,
  DRIVE_FINAL_FOLDER_ID: undefined,
  BROWSERLESS_URL: undefined,
  MAKE_FALLBACK_WEBHOOK: undefined,
};
