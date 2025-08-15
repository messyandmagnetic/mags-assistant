#!/usr/bin/env python3
"""Extract engaging clips from raw footage stored on Google Drive.

This script downloads videos from the "Raw Clips" folder on Drive and uses
Whisper and FFmpeg to detect speech and visual spikes. It automatically cuts
punchy 5–15 second clips, saves them to the local ``Staging/`` directory and
logs each extraction to ``public/mags-log.json``.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Iterable, List

try:  # optional heavy deps; script still runs if missing
    import cv2  # type: ignore
except Exception:  # pragma: no cover - dependency is optional
    cv2 = None  # type: ignore

try:  # Google Vision may not be installed
    from google.cloud import vision  # type: ignore
except Exception:  # pragma: no cover
    vision = None  # type: ignore

import urllib.request

import gdown  # type: ignore
import whisper  # type: ignore

DRIVE_ID = "1m-OjLhXttfS655ldGJxr9xFOqsWY25sD"
RAW_DIR = Path("Raw Clips")
STAGING_DIR = Path("Staging")
LOG_PATH = Path("public/mags-log.json")

WHISPER_MODEL = os.getenv("WHISPER_MODEL", "small")
model = whisper.load_model(WHISPER_MODEL)


def download_raw_clips() -> None:
    """Pull the latest raw clips from Google Drive into ``RAW_DIR``."""
    RAW_DIR.mkdir(exist_ok=True)
    gdown.download_folder(id=DRIVE_ID, output=str(RAW_DIR), quiet=True, use_cookies=False)


def load_log() -> dict:
    if LOG_PATH.exists():
        return json.loads(LOG_PATH.read_text())
    return {"clips": []}


def save_log(data: dict) -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    LOG_PATH.write_text(json.dumps(data, indent=2))


def get_duration(path: Path) -> float:
    """Return duration of ``path`` in seconds using ffprobe."""
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(path),
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return float(res.stdout.strip())


def detect_scenes(path: Path) -> List[float]:
    """Return a list of timestamps where large visual changes occur."""
    cmd = [
        "ffprobe",
        "-f",
        "lavfi",
        "-i",
        f"movie={path},select=gt(scene\\,0.4)",
        "-show_entries",
        "frame=pkt_pts_time",
        "-of",
        "csv=p=0",
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    if not res.stdout.strip():
        return []
    return [float(t) for t in res.stdout.strip().splitlines()]


def keywords_from_text(text: str) -> List[str]:
    """Extract a few keywords from the transcript."""
    stop = {
        "the",
        "and",
        "a",
        "to",
        "of",
        "in",
        "is",
        "it",
        "that",
        "for",
        "on",
    }
    words = [re.sub(r"[^0-9a-z]+", "", w.lower()) for w in text.split()]
    words = [w for w in words if w and w not in stop]
    return words[:5]


def cut_clip(src: Path, start: float, end: float, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(src),
        "-ss",
        str(start),
        "-to",
        str(end),
        "-c",
        "copy",
        str(dest),
    ]
    subprocess.run(cmd, check=True)


def telegram_notify(text: str) -> None:
    """Send a Telegram message if credentials are present."""
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


def detect_risky_content(path: Path) -> bool:
    """Return True if ``path`` appears to contain risky visuals."""
    # Prefer Google Vision SafeSearch when available
    if vision is not None:  # pragma: no cover - requires external service
        client = vision.ImageAnnotatorClient()
        try:
            with open(path, "rb") as f:
                content = f.read()
            image = vision.Image(content=content)
            response = client.safe_search_detection(image=image)
            safe = response.safe_search_annotation
            likelihood = {4, 5}  # LIKELY or VERY_LIKELY
            if (
                getattr(safe, "adult", 0) in likelihood
                or getattr(safe, "violence", 0) in likelihood
                or getattr(safe, "racy", 0) in likelihood
            ):
                return True
        except Exception:
            pass

    if cv2 is None:  # OpenCV not installed
        return False

    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        return False
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    step = max(frame_count // 10, 1)
    idx = 0
    risky = 0
    total = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if idx % step == 0:
            hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
            lower = (0, 40, 60)
            upper = (20, 150, 255)
            mask = cv2.inRange(hsv, lower, upper)
            ratio = float(cv2.countNonZero(mask)) / float(mask.size)
            if ratio > 0.4:  # large amount of exposed skin
                risky += 1
            total += 1
        idx += 1
    cap.release()
    return total > 0 and (risky / total) > 0.3


def blur_video(path: Path) -> None:
    """Blur the entire video in-place using ffmpeg."""
    tmp = path.with_suffix(".blur.mp4")
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(path),
        "-vf",
        "boxblur=10:1",
        str(tmp),
    ]
    subprocess.run(cmd, check=True)
    tmp.replace(path)


def sanitize_clip(path: Path, entry: dict) -> bool:
    """Blur risky clips. Return False if clip should be skipped."""
    if detect_risky_content(path):
        try:
            blur_video(path)
            entry["fix"] = "blurred"
            return True
        except Exception:
            path.unlink(missing_ok=True)
            telegram_notify(f"skipped {path.name}: risky and unsalvageable")
            return False
    return True


def pick_boundary(points: Iterable[float], t: float, default: float, reverse: bool = False) -> float:
    pts = [p for p in points if p <= t] if reverse else [p for p in points if p >= t]
    if not pts:
        return default
    return pts[-1] if reverse else pts[0]


def process_video(video: Path, log: dict) -> None:
    scenes = detect_scenes(video)
    duration = get_duration(video)
    result = model.transcribe(str(video), verbose=False)
    segments = result.get("segments", [])
    for seg in segments:
        start = max(seg.get("start", 0.0) - 0.5, 0.0)
        end = seg.get("end", 0.0) + 0.5
        if end - start < 5:
            end = start + 5
        if end - start > 15:
            end = start + 15
        start = pick_boundary(scenes, start, 0.0, reverse=True)
        end = pick_boundary(scenes, end, duration, reverse=False)
        if end <= start:
            continue
        clip_name = f"{video.stem}_{int(start*1000):06d}-{int(end*1000):06d}.mp4"
        clip_path = STAGING_DIR / clip_name
        cut_clip(video, start, end, clip_path)
        entry = {
            "source": video.name,
            "clip": str(clip_path),
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "keywords": keywords_from_text(seg.get("text", "")),
        }
        if sanitize_clip(clip_path, entry):
            log["clips"].append(entry)


def main() -> None:
    download_raw_clips()
    log = load_log()
    for video in RAW_DIR.glob("*.mp4"):
        process_video(video, log)
    save_log(log)


if __name__ == "__main__":
    main()
