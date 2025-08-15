#!/usr/bin/env python3
"""Compile weekly social insights and share to Telegram and Notion."""

from __future__ import annotations

import json
import os
from collections import Counter
from pathlib import Path

import requests  # type: ignore

LOG_PATH = Path("public/mags-log.json")
PACK_PATH = Path(".schedule-pack.json")


def main() -> None:
    hooks: Counter[str] = Counter()
    sounds: Counter[str] = Counter()
    emotions: Counter[str] = Counter()
    if LOG_PATH.exists():
        log = json.loads(LOG_PATH.read_text())
        for clip in log.get("clips", []):
            for k in clip.get("keywords", []):
                hooks[k] += 1
            if clip.get("emotion"):
                emotions[clip["emotion"]] += 1
    if PACK_PATH.exists():
        pack = json.loads(PACK_PATH.read_text())
        for q in pack.get("queue", []):
            if q.get("suggested_sound"):
                sounds[q["suggested_sound"]] += 1
    message = (
        "Weekly Insights\n" +
        "Top hooks: " + ", ".join(f"{k}({v})" for k, v in hooks.most_common(3)) +
        "\nTop sounds: " + ", ".join(f"{k}({v})" for k, v in sounds.most_common(3)) +
        "\nTop emotions: " + ", ".join(f"{k}({v})" for k, v in emotions.most_common(3))
    )
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat = os.getenv("TELEGRAM_CHAT_ID")
    if token and chat:
        try:
            requests.post(
                f"https://api.telegram.org/bot{token}/sendMessage",
                data={"chat_id": chat, "text": message},
            )
        except Exception:
            pass
    notion_token = os.getenv("NOTION_TOKEN")
    notion_db = os.getenv("NOTION_TREND_DB")
    if notion_token and notion_db:
        try:
            requests.post(
                "https://api.notion.com/v1/pages",
                headers={
                    "Authorization": f"Bearer {notion_token}",
                    "Notion-Version": "2022-06-28",
                },
                json={
                    "parent": {"database_id": notion_db},
                    "properties": {
                        "Name": {"title": [{"text": {"content": "Weekly Insights"}}]},
                        "Summary": {"rich_text": [{"text": {"content": message}}]},
                    },
                },
            )
        except Exception:
            pass


if __name__ == "__main__":
    main()
