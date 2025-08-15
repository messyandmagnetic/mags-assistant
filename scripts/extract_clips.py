#!/usr/bin/env python3
"""Extract engaging clips from raw footage stored on Google Drive.

This script downloads videos from the "Raw Clips" folder on Drive and uses
Whisper, Google Vision, and simple scene detection to surface viral moments.
Any clip that contains shirtless children or other TikTok-risky visuals is
automatically covered with an emoji rather than deleted. Metadata for every
clip is written to ``public/mags-log.json``.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import random
from datetime import datetime, timedelta
from pathlib import Path
from typing import Iterable, List, Tuple, Dict, Any

import requests  # type: ignore

import gdown  # type: ignore
import whisper  # type: ignore
from google.cloud import vision  # type: ignore

DRIVE_ID = os.getenv("DRIVE_FOLDER_ID", "1m-OjLhXttfS655ldGJxr9xFOqsWY25sD")
RAW_DIR = Path("Raw Clips")
STAGING_DIR = Path("Staging")
LOG_PATH = Path("public/mags-log.json")
PACK_PATH = Path("public/schedule-pack.json")
WORKER_URL = "https://tight-snow-2840.messyandmagnetic.workers.dev"

WHISPER_MODEL = os.getenv("WHISPER_MODEL", "small")
model = whisper.load_model(WHISPER_MODEL)
SERVICE_ACCOUNT = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON")
vision_client = (
    vision.ImageAnnotatorClient.from_service_account_json(SERVICE_ACCOUNT)
    if SERVICE_ACCOUNT
    else vision.ImageAnnotatorClient()
)


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


def load_pack() -> dict:
    if PACK_PATH.exists():
        return json.loads(PACK_PATH.read_text())
    return {"generated_at": datetime.utcnow().isoformat() + "Z", "worker": WORKER_URL, "queue": []}


def save_pack(data: dict) -> None:
    PACK_PATH.parent.mkdir(parents=True, exist_ok=True)
    PACK_PATH.write_text(json.dumps(data, indent=2))


def fetch_trend() -> Dict[str, str]:
    try:
        resp = requests.get("https://www.tiktok.com/api/trending/item_list/?count=30", timeout=10)
        items = resp.json().get("itemList", [])
        if items:
            it = random.choice(items)
            return {
                "sound": it.get("music", {}).get("title", ""),
                "caption": it.get("desc", ""),
            }
    except Exception:
        pass
    return {}


def send_preview(entry: Dict[str, Any], clip_path: Path) -> None:
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat = os.getenv("TELEGRAM_CHAT_ID")
    if not token or not chat:
        return
    thumb = clip_path.with_suffix(".jpg")
    subprocess.run(["ffmpeg", "-y", "-i", str(clip_path), "-ss", "0", "-vframes", "1", str(thumb)], check=True)
    caption = (
        f"{entry.get('emoji', '')} {entry['title']}\n{entry['caption']}\n{' '.join(entry['hashtags'])}\n{entry['suggested_time']}"
    ).strip()
    buttons = {
        "inline_keyboard": [[
            {"text": "Approve", "callback_data": f"approve:{entry['slug']}"},
            {"text": "Edit Caption", "callback_data": f"edit:{entry['slug']}"},
            {"text": "Skip", "callback_data": f"skip:{entry['slug']}"},
        ]]
    }
    with thumb.open("rb") as img:
        try:
            requests.post(
                f"https://api.telegram.org/bot{token}/sendPhoto",
                data={"chat_id": chat, "caption": caption, "reply_markup": json.dumps(buttons)},
                files={"photo": img},
            )
        except Exception as e:
            print("telegram send failed", e)
    thumb.unlink(missing_ok=True)


def enqueue_clip(entry: Dict[str, Any]) -> None:
    pack = load_pack()
    trend = fetch_trend()
    suggested = datetime.utcnow() + timedelta(hours=1)
    queue_entry = {
        "slug": Path(entry["clip"]).stem,
        "title": " ".join(entry.get("keywords", [])) or "Clip",
        "caption": " ".join(entry.get("keywords", [])),
        "hashtags": ["#" + k for k in entry.get("keywords", [])],
        "suggested_time": suggested.isoformat() + "Z",
        "emoji": entry.get("overlay"),
        "trend_audio": trend.get("sound"),
        "status": "queued",
        "clip": entry["clip"],
    }
    pack.setdefault("queue", []).append(queue_entry)
    pack["generated_at"] = datetime.utcnow().isoformat() + "Z"
    pack.setdefault("worker", WORKER_URL)
    save_pack(pack)
    send_preview(queue_entry, Path(entry["clip"]))


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


def pick_boundary(points: Iterable[float], t: float, default: float, reverse: bool = False) -> float:
    pts = [p for p in points if p <= t] if reverse else [p for p in points if p >= t]
    if not pts:
        return default
    return pts[-1] if reverse else pts[0]


def analyze_visual(path: Path) -> Tuple[vision.SafeSearchAnnotation, List[str]]:
    """Return safe-search annotation and label descriptions."""
    with path.open("rb") as f:
        content = f.read()
    image = vision.Image(content=content)
    response = vision_client.annotate_image(
        {
            "image": image,
            "features": [
                {"type": vision.Feature.Type.SAFE_SEARCH_DETECTION},
                {"type": vision.Feature.Type.LABEL_DETECTION, "max_results": 10},
            ],
        }
    )
    annotation = response.safe_search_annotation
    labels = [lab.description.lower() for lab in response.label_annotations]
    return annotation, labels


def is_high(flag: vision.Likelihood) -> bool:
    return flag in (vision.Likelihood.LIKELY, vision.Likelihood.VERY_LIKELY)


def is_mild(flag: vision.Likelihood) -> bool:
    return flag == vision.Likelihood.POSSIBLE


def overlay_emoji(path: Path, emoji: str) -> None:
    """Overlay ``emoji`` on ``path`` using ffmpeg."""
    censored = path.with_name(path.stem + "_censored" + path.suffix)
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(path),
        "-vf",
        f"drawtext=text='{emoji}':fontcolor=white:fontsize=64:x=(w-text_w)/2:y=(h-text_h)/2",
        "-codec:a",
        "copy",
        str(censored),
    ]
    subprocess.run(cmd, check=True)
    path.unlink()
    censored.rename(path)


def sanitize_clip(path: Path) -> Dict[str, Any] | None:
    annotation, labels = analyze_visual(path)
    info: Dict[str, Any] = {
        "safe_search": {
            "adult": int(annotation.adult),
            "violence": int(annotation.violence),
            "racy": int(annotation.racy),
            "labels": labels,
        }
    }
    if is_high(annotation.violence):
        path.unlink(missing_ok=True)
        return None
    emoji = None
    if is_high(annotation.adult) or is_high(annotation.racy):
        emoji = "🫣"
    elif any("shirtless" in l and "child" in l for l in labels):
        emoji = "👕"  # 👕
    if emoji:
        overlay_emoji(path, emoji)
        info["overlay"] = emoji
    elif any(
        is_mild(v) for v in [annotation.adult, annotation.violence, annotation.racy]
    ):
        overlay_emoji(path, "🫣")
        info["overlay"] = "🫣"
    return info


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
        info = sanitize_clip(clip_path)
        if info is None:
            continue
        entry = {
            "source": video.name,
            "clip": str(clip_path),
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "keywords": keywords_from_text(seg.get("text", "")),
            **info,
        }
        log["clips"].append(entry)
        enqueue_clip(entry)


def main() -> None:
    download_raw_clips()
    log = load_log()
    for video in RAW_DIR.glob("*.mp4"):
        process_video(video, log)
    log["updated"] = datetime.utcnow().isoformat() + "Z"
    save_log(log)


if __name__ == "__main__":
    main()
