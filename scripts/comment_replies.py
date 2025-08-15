#!/usr/bin/env python3
"""Reply to comments in a casual style matching Chanel.

This script reads pending comments from ``comments_inbox.json`` (if present),
crafts a natural reply using ellipses and comma flow, optionally draws from
``memoir_log.json`` for extra flavor, and logs replies to ``public/mags-log.json``.
Comments containing banned words are skipped with a Telegram notification.
"""
from __future__ import annotations

import json
import os
import random
from datetime import datetime
from pathlib import Path
from typing import Dict, List
import urllib.request

LOG_PATH = Path("public/mags-log.json")
INBOX_PATH = Path("comments_inbox.json")
MEMOIR_PATH = Path("memoir_log.json")

BANNED_WORDS = {"hate", "kill", "racist", "nazi"}


def telegram_notify(text: str) -> None:
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat = os.getenv("TELEGRAM_CHAT_ID")
    if not token or not chat:
        return
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    data = json.dumps({"chat_id": chat, "text": text}).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        urllib.request.urlopen(req, timeout=10)
    except Exception:
        pass


def load_log() -> dict:
    if LOG_PATH.exists():
        return json.loads(LOG_PATH.read_text())
    return {"clips": []}


def save_log(data: dict) -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    LOG_PATH.write_text(json.dumps(data, indent=2))


def load_memoir_quotes() -> List[str]:
    if MEMOIR_PATH.exists():
        try:
            data = json.loads(MEMOIR_PATH.read_text())
            if isinstance(data, dict) and "quotes" in data:
                return list(map(str, data["quotes"]))
            if isinstance(data, list):
                return list(map(str, data))
        except Exception:
            pass
    return []


def fetch_comments() -> List[Dict[str, str]]:
    if INBOX_PATH.exists():
        try:
            return json.loads(INBOX_PATH.read_text())
        except Exception:
            return []
    return []


def is_offensive(text: str) -> bool:
    low = text.lower()
    return any(word in low for word in BANNED_WORDS)


def casual_reply(text: str, quotes: List[str]) -> str:
    base = text.lower()
    reply = "yeah, "
    if "?" in text:
        reply = "good question, "
    elif "love" in base:
        reply = "aww thanks, "
    if quotes:
        reply += random.choice(quotes) + "..."
    else:
        reply += "thanks for dropping by..."
    return reply.replace("--", "-")


def post_reply(comment_id: str, reply: str) -> None:
    # Placeholder for API call to post a reply
    pass


def log_reply(comment_id: str, reply: str) -> None:
    log = load_log()
    log.setdefault("replies", []).append(
        {"id": comment_id, "reply": reply, "timestamp": datetime.utcnow().isoformat() + "Z"}
    )
    save_log(log)


def main() -> None:
    quotes = load_memoir_quotes()
    for comment in fetch_comments():
        text = comment.get("text", "")
        cid = comment.get("id", "")
        if not cid or is_offensive(text):
            telegram_notify(f"skipped comment {cid}: {text}")
            continue
        reply = casual_reply(text, quotes)
        post_reply(cid, reply)
        log_reply(cid, reply)


if __name__ == "__main__":
    main()
