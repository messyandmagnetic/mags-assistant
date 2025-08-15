#!/usr/bin/env python3
"""Schedule clips for posting during high-engagement windows.

This script scans the ``Staging`` directory for extracted clips and assigns
publish times inside pre-defined engagement windows. It avoids scheduling the
same clip twice by tracking scheduled entries in ``public/mags-log.json``.
"""
from __future__ import annotations

import json
from datetime import datetime, time, timedelta
from pathlib import Path
from typing import Iterator, List, Tuple

STAGING_DIR = Path("Staging")
LOG_PATH = Path("public/mags-log.json")

ENGAGEMENT_WINDOWS: List[Tuple[time, time]] = [
    (time(9, 0), time(11, 0)),
    (time(14, 0), time(16, 0)),
    (time(19, 0), time(21, 0)),
]


def load_log() -> dict:
    if LOG_PATH.exists():
        return json.loads(LOG_PATH.read_text())
    return {"clips": []}


def save_log(data: dict) -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    LOG_PATH.write_text(json.dumps(data, indent=2))


def iter_windows(start: datetime) -> Iterator[datetime]:
    day = start.date()
    while True:
        for win_start, win_end in ENGAGEMENT_WINDOWS:
            dt = datetime.combine(day, win_start)
            if dt >= start:
                yield dt
        day += timedelta(days=1)


def schedule() -> None:
    log = load_log()
    scheduled = {entry["clip"] for entry in log.get("schedule", [])}
    clips = sorted(STAGING_DIR.glob("*.mp4"))
    win_gen = iter_windows(datetime.utcnow())
    for clip in clips:
        clip_str = str(clip)
        if clip_str in scheduled:
            continue
        slot = next(win_gen)
        log.setdefault("schedule", []).append(
            {"clip": clip_str, "time": slot.isoformat() + "Z"}
        )
    save_log(log)
if __name__ == "__main__":
    schedule()
