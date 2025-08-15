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
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Iterable, List, Tuple, Dict, Any

import requests  # type: ignore

import gdown  # type: ignore
import whisper  # type: ignore
from google.cloud import vision  # type: ignore

TONE_LIB_PATH = Path("data/chanel_tone.json")
TONE_LIBRARY = (
    json.loads(TONE_LIB_PATH.read_text()) if TONE_LIB_PATH.exists() else {"captions": []}
)

DRIVE_ID = os.getenv("DRIVE_FOLDER_ID", "1m-OjLhXttfS655ldGJxr9xFOqsWY25sD")
RAW_DIR = Path("Raw Clips")
STAGING_DIR = Path("Staging")
LOG_PATH = Path("public/mags-log.json")
PACK_PATH = Path(".schedule-pack.json")
USERNAME_PATH = Path("config/tiktok_usernames.json")
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
                "url": it.get("music", {}).get("playUrl", ""),
            }
    except Exception:
        pass
    return {}


def send_preview(entry: Dict[str, Any], clip_path: Path) -> None:
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat = os.getenv("TELEGRAM_CHAT_ID")
    if not token or not chat:
        return
    thumb = Path(entry.get("cover_frame", clip_path.with_suffix(".jpg")))
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


def send_summary(count: int) -> None:
    if count <= 0:
        return
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat = os.getenv("TELEGRAM_CHAT_ID")
    if not token or not chat:
        return
    try:
        requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            data={"chat_id": chat, "text": f"{count} new edits ready"},
        )
    except Exception as e:
        print("telegram summary failed", e)


def enqueue_clip(entry: Dict[str, Any]) -> None:
    pack = load_pack()
    trend = fetch_trend()
    suggested = datetime.utcnow() + timedelta(hours=1)
    clip_path = Path(entry["clip"])
    thumb = clip_path.with_suffix(".jpg")
    subprocess.run([
        "ffmpeg",
        "-y",
        "-i",
        str(clip_path),
        "-ss",
        "0",
        "-vframes",
        "1",
        str(thumb),
    ], check=True)
    caption, hashtags = generate_caption(entry.get("keywords", []))
    queue_entry = {
        "fileId": entry.get("source", clip_path.stem),
        "slug": clip_path.stem,
        "title": caption or "Clip",
        "edit_type": entry.get("edit_type", "cut"),
        "emotion": entry.get("emotion"),
        "remix_notes": entry.get("remix_notes", ""),
        "suggested_sound": trend.get("sound"),
        "suggested_sound_url": trend.get("url"),
        "cover_frame": str(thumb),
        "platformHints": {},
        "captions": {"tiktok": caption},
        "caption": caption,
        "hashtags": hashtags,
        "suggested_time": suggested.isoformat() + "Z",
        "emoji": entry.get("overlay"),
        "status": "queued",
        "clip": entry["clip"],
    }
    pack.setdefault("queue", []).append(queue_entry)
    pack["generated_at"] = datetime.utcnow().isoformat() + "Z"
    pack.setdefault("worker", WORKER_URL)
    save_pack(pack)
    send_preview(queue_entry, clip_path)


def _load_usernames() -> Dict[str, str]:
    if USERNAME_PATH.exists():
        try:
            return json.loads(USERNAME_PATH.read_text())
        except Exception:
            return {}
    return {}


def load_sessions() -> Dict[str, str]:
    sessions: Dict[str, str] = {}
    for k, v in os.environ.items():
        if k.startswith("TIKTOK_SESSION_") and v:
            role = k[len("TIKTOK_SESSION_") :]
            sessions[role] = v
    return sessions


def update_profile(
    session_id: str,
    name: str,
    bio: str,
    image_url: str | None = None,
    gender: str | None = None,
) -> None:
    payload: Dict[str, Any] = {"nickname": name, "signature": bio}
    if gender is not None:
        payload["gender"] = gender
    if image_url:
        payload["avatar_url"] = image_url
    try:
        time.sleep(random.uniform(0.5, 1.5))
        resp = requests.post(
            "https://www.tiktok.com/api/edit/profile/",
            headers={"Cookie": f"sessionid={session_id}"},
            json=payload,
            timeout=10,
        )
        resp.raise_for_status()
        print(f"[tiktok] profile updated for {name}")
    except Exception as e:
        print(f"[tiktok] profile update failed for {name}: {e}")


def bulk_update_profiles() -> None:
    sessions = load_sessions()
    names = [
        "Lena",
        "Rory",
        "Jules",
        "Mara",
        "Piper",
        "Sage",
        "Nico",
        "Kira",
        "Zara",
        "Indie",
        "Lux",
        "Nova",
        "Bex",
        "Finn",
        "Remy",
        "Kai",
    ]
    bios = [
        "currently soft launching my chaos ☁️",
        "accidentally documenting my life arc",
        "posting unhinged things and calling it art",
        "just vibing on the internet",
        "here for a good time, not a long time",
        "collecting moments not things ✨",
        "emotionally invested in my coffee",
        "half feral, half vibe curator",
        "screaming into the aesthetic void",
        "spilling tea then meditating about it",
    ]
    used_names: set[str] = set()
    for role, session in random.sample(list(sessions.items()), len(sessions)):
        if role in {"MAIN", "ALT"}:
            continue
        info: Dict[str, Any] = {}
        has_image = True
        nickname = ""
        signature = ""
        try:
            resp = requests.get(
                "https://www.tiktok.com/api/user/info/",
                headers={"Cookie": f"sessionid={session}"},
                timeout=10,
            )
            if resp.ok:
                info = resp.json().get("user", {})
                nickname = info.get("nickname", "")
                signature = info.get("signature", "")
                has_image = bool(info.get("avatar_medium", {}).get("url_list"))
        except Exception:
            pass

        def is_default(name: str) -> bool:
            return not name or name.lower().startswith("user")

        force_update = role.lower() == "messy.mars4"
        if not force_update and not is_default(nickname) and signature:
            print(f"[tiktok] skip {role} (custom profile)")
            continue
        available = [n for n in names if n not in used_names] or [f"user{random.randint(1000,9999)}"]
        name = random.choice(available)
        used_names.add(name)
        bio = random.choice(bios)
        image_url = None
        if not has_image and not force_update:
            image_url = f"https://i.pravatar.cc/300?u={random.randint(1000,9999)}"
        update_profile(session, name, bio, image_url)
        time.sleep(random.uniform(1, 3))


def _parse_time(ts: str | None) -> datetime | None:
    if not ts:
        return None
    try:
        if ts.endswith("Z"):
            ts = ts[:-1] + "+00:00"
        return datetime.fromisoformat(ts)
    except ValueError:
        return None


COMMENTS = {
    "humor": ["😂", "lol this is great", "🤣"],
    "support": ["love this", "so good", "🔥"],
    "questions": ["how??", "where is this?", "more please"]
}


def booster_engage(item: Dict[str, Any], boosters: Dict[str, str], usernames: Dict[str, str]) -> None:
    emotion = item.get("emotion")
    for role, session in boosters.items():
        uname = usernames.get(role, f"@{role}")
        print(f"[tiktok] booster {role} ({uname}) engage")
        # like
        try:
            requests.post(
                "https://www.tiktok.com/api/like",
                headers={"Cookie": f"sessionid={session}"},
                timeout=10,
            )
        except Exception:
            pass
        # maybe comment
        if random.random() < 0.7:
            cat = {
                "funny": "humor",
                "emotional": "support",
            }.get(emotion, random.choice(list(COMMENTS.keys())))
            comment = random.choice(COMMENTS[cat])
            try:
                requests.post(
                    "https://www.tiktok.com/api/comment",
                    headers={"Cookie": f"sessionid={session}"},
                    json={"text": comment},
                    timeout=10,
                )
            except Exception:
                pass
        # maybe save
        if random.random() < 0.5:
            try:
                requests.post(
                    "https://www.tiktok.com/api/save",
                    headers={"Cookie": f"sessionid={session}"},
                    timeout=10,
                )
            except Exception:
                pass
        # maybe follow
        if random.random() < 0.3:
            try:
                requests.post(
                    "https://www.tiktok.com/api/follow",
                    headers={"Cookie": f"sessionid={session}"},
                    timeout=10,
                )
            except Exception:
                pass
        time.sleep(random.uniform(1, 4))


def autopost_queue() -> None:
    sessions = load_sessions()
    if "MAIN" not in sessions:
        return
    usernames = _load_usernames()
    main_session = sessions["MAIN"]
    pack = load_pack()
    queue = [
        q
        for q in pack.get("queue", [])
        if q.get("status") == "queued" and q.get("autopost")
    ]
    now = datetime.utcnow()
    ready = []
    for q in queue:
        ts = _parse_time(q.get("scheduled_time")) or _parse_time(q.get("suggested_time"))
        if ts and ts <= now:
            ready.append(q)
    if not ready:
        return
    ready.sort(key=lambda x: x.get("scheduled_time") or x.get("suggested_time") or "")
    item = ready[0]
    print("[tiktok] posting", item.get("fileId"))
    try:
        requests.post(
            "https://www.tiktok.com/api/post",
            headers={"Cookie": f"sessionid={main_session}"},
            timeout=10,
        )
    except Exception:
        pass
    boosters = {r: s for r, s in sessions.items() if r != "MAIN"}
    if boosters:
        booster_engage(item, boosters, usernames)
    item["status"] = "posted"
    item["posted_at"] = now.isoformat() + "Z"
    save_pack(pack)
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat = os.getenv("TELEGRAM_CHAT_ID")
    if token and chat:
        roles = {r: usernames.get(r, f"@{r}") for r in sessions}
        msg = "TikTok autopost complete\n" + "\n".join(
            f"{role}: {name}" for role, name in roles.items()
        )
        try:
            requests.post(
                f"https://api.telegram.org/bot{token}/sendMessage",
                data={"chat_id": chat, "text": msg},
            )
        except Exception:
            pass


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


def detect_emotion(text: str) -> str:
    lower = text.lower()
    if any(k in lower for k in ["laugh", "funny", "joke", "haha"]):
        return "funny"
    if any(k in lower for k in ["cry", "love", "heart", "feel", "sad"]):
        return "emotional"
    return "inspiring"


def generate_caption(keywords: List[str]) -> Tuple[str, List[str]]:
    base = random.choice(TONE_LIBRARY.get("captions", [""]))
    caption = (base + " " + " ".join(keywords)).strip()
    hashtags = ["#" + k for k in keywords]
    return caption, hashtags


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


def blur_video(path: Path) -> None:
    blurred = path.with_name(path.stem + "_blur" + path.suffix)
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(path),
        "-vf",
        "boxblur=10:1",
        "-c:a",
        "copy",
        str(blurred),
    ]
    subprocess.run(cmd, check=True)
    path.unlink()
    blurred.rename(path)


def combine_clips(clips: List[Path]) -> Path | None:
    if not clips:
        return None
    clips = sorted(clips)
    date = datetime.utcnow().strftime("%Y%m%d")
    dest = STAGING_DIR / f"combo_{date}.mp4"
    list_file = STAGING_DIR / f"combo_{date}.txt"
    list_file.write_text("\n".join(f"file '{c}'" for c in clips))
    cmd = [
        "ffmpeg",
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        str(list_file),
        "-c",
        "copy",
        str(dest),
    ]
    subprocess.run(cmd, check=True)
    list_file.unlink()
    return dest


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
        emoji = "👕"
        blur_video(path)
    if emoji:
        overlay_emoji(path, emoji)
        info["overlay"] = emoji
    elif any(
        is_mild(v) for v in [annotation.adult, annotation.violence, annotation.racy]
    ):
        overlay_emoji(path, "🫣")
        info["overlay"] = "🫣"
    return info


def process_video(video: Path, log: dict) -> int:
    scenes = detect_scenes(video)
    duration = get_duration(video)
    result = model.transcribe(str(video), verbose=False)
    segments = result.get("segments", [])
    count = 0
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
        kws = keywords_from_text(seg.get("text", ""))
        entry = {
            "source": video.name,
            "clip": str(clip_path),
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "keywords": kws,
            "emotion": detect_emotion(seg.get("text", "")),
            **info,
        }
        log["clips"].append(entry)
        enqueue_clip(entry)
        count += 1
    return count


def main() -> None:
    bulk_update_profiles()
    download_raw_clips()
    log = load_log()
    new_count = 0
    for video in RAW_DIR.glob("*.mp4"):
        new_count += process_video(video, log)
    log["updated"] = datetime.utcnow().isoformat() + "Z"
    save_log(log)
    send_summary(new_count)
    if os.getenv("COMBINE_CLIPS"):
        today = datetime.utcnow().strftime("%Y-%m-%d")
        clips = [Path(c["clip"]) for c in log["clips"] if c["timestamp"].startswith(today)]
        combine_clips(clips)
    autopost_queue()


if __name__ == "__main__":
    main()
