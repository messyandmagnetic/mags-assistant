export const localEnv: Record<string, string> = {
  DRIVE_FOLDER_ID: '',
  DRIVE_FINAL_FOLDER_ID: '',
  SHEET_ID: '',
  TELEGRAM_BOT_TOKEN: '',
  TELEGRAM_CHAT_ID: '',
  BROWSERLESS_URL: '',
  BROWSERLESS_TOKEN: '',
  MAKE_FALLBACK_WEBHOOK: '',
};

export function getEnv(key: string): string {
  return process.env[key] || localEnv[key] || '';
}
