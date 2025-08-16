"""Telegram reporter for Maggie.

Sends twice-daily summaries of posted videos, trends, and flops.
"""
import os
from datetime import datetime
from telegram import Bot

TOKEN = os.environ.get("TELEGRAM_TOKEN")  # <-- insert Telegram bot token
CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID")  # <-- insert Telegram chat ID
TONE_FILE = os.environ.get("TONE_FILE", "tone.json")


def build_message() -> str:
    """Construct a daily summary message.

    Real implementation should pull data from Google Sheets and trend scraper.
    Tone settings from TONE_FILE can adjust phrasing.
    """
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    return f"Maggie Report {now}\n- posted: 0\n- flops: 0\n- trends: none"


def main() -> None:
    if not TOKEN or not CHAT_ID:
        raise SystemExit("Missing TELEGRAM_TOKEN or TELEGRAM_CHAT_ID")
    bot = Bot(TOKEN)
    message = build_message()
    bot.send_message(chat_id=CHAT_ID, text=message)


if __name__ == "__main__":
    main()
