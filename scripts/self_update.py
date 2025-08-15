#!/usr/bin/env python3
"""Weekly self-update tasks for Maggie.

This script cleans old learning logs, refreshes TikTok strategy,
updates grant recommendations, and tags memoir-worthy events.
"""

import argparse
import datetime as dt
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BRAIN_DIR = ROOT / "brain"
MEMORY_FILE = BRAIN_DIR / "memory.json"
LOG_FILE = BRAIN_DIR / "learning_log.json"


def load_json(path: Path, default):
    try:
        return json.loads(path.read_text())
    except Exception:
        return default


def save_json(path: Path, data, dry_run: bool):
    if dry_run:
        return
    path.write_text(json.dumps(data, indent=2))


def clean_old_logs(log, days: int = 30):
    cutoff = dt.datetime.utcnow() - dt.timedelta(days=days)
    cleaned = []
    for entry in log:
        ts = entry.get("ts")
        try:
            if dt.datetime.fromisoformat(ts) > cutoff:
                cleaned.append(entry)
        except Exception:
            cleaned.append(entry)
    return cleaned


def refresh_tiktok_strategy(mem):
    strat = mem.setdefault("tiktok_strategy", {"last_refresh": None, "notes": []})
    strat["last_refresh"] = dt.datetime.utcnow().isoformat()
    return mem


def update_grant_recommendations(mem):
    grants = mem.setdefault("grant_recommendations", [])
    grants.append({"ts": dt.datetime.utcnow().isoformat(), "notes": "Auto refresh"})
    return mem


def tag_memoir_events(mem):
    tags = mem.setdefault("memoir_worthy", [])
    tags.append({"ts": dt.datetime.utcnow().isoformat(), "tag": "auto"})
    return mem


def main(dry_run: bool = False):
    mem = load_json(MEMORY_FILE, {})
    log = load_json(LOG_FILE, [])
    log = clean_old_logs(log)
    mem = refresh_tiktok_strategy(mem)
    mem = update_grant_recommendations(mem)
    mem = tag_memoir_events(mem)
    save_json(MEMORY_FILE, mem, dry_run)
    save_json(LOG_FILE, log, dry_run)
    if not dry_run:
        log.append({"ts": dt.datetime.utcnow().isoformat(), "event": "self_update"})
        save_json(LOG_FILE, log, False)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="perform logic without writing files")
    args = parser.parse_args()
    main(dry_run=args.dry_run)
