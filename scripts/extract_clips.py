#!/usr/bin/env python3
"""Extract short clips from raw videos using FFmpeg, Whisper, and OpenAI Vision.
This script scans provided video files, identifies high-emotion moments,
checks for safety issues, and writes clips to the AutoClips directory.
"""

import json
import pathlib
import subprocess
from typing import List, Tuple

AUTOCLIPS_DIR = pathlib.Path('AutoClips')
LOG_PATH = pathlib.Path('public/mags-log.json')
AUTOCLIPS_DIR.mkdir(exist_ok=True)


def load_log() -> dict:
    if LOG_PATH.exists():
        with open(LOG_PATH) as f:
            return json.load(f)
    return {"drops": [], "clips": [], "trends": [], "posts": []}


def save_log(data: dict) -> None:
    with open(LOG_PATH, 'w') as f:
        json.dump(data, f, indent=2)


def get_duration(path: str) -> float:
    try:
        result = subprocess.run(
            [
                'ffprobe',
                '-v',
                'error',
                '-show_entries',
                'format=duration',
                '-of',
                'default=noprint_wrappers=1:nokey=1',
                path,
            ],
            capture_output=True,
            text=True,
            check=True,
        )
        return float(result.stdout.strip())
    except Exception:
        return 0.0


def detect_highlights(video_path: str) -> List[Tuple[float, float]]:
    """Placeholder highlight detection.
    Real implementation would use Whisper and emotion models.
    """
    duration = get_duration(video_path)
    end = min(5, duration)
    return [(0.0, end)] if end > 0 else []


def safe(video_path: str) -> bool:
    """Placeholder safety check using OpenAI Vision.
    Returns True when content is considered safe.
    """
    return True


def extract(video_path: str) -> List[str]:
    clips = []
    for idx, (start, end) in enumerate(detect_highlights(video_path), start=1):
        out_path = AUTOCLIPS_DIR / f"{pathlib.Path(video_path).stem}_clip{idx}.mp4"
        duration = end - start
        subprocess.run(
            ['ffmpeg', '-y', '-ss', str(start), '-i', video_path, '-t', str(duration), '-c', 'copy', str(out_path)],
            check=False,
        )
        clips.append(str(out_path))
    return clips


def process(video_path: str) -> List[str]:
    if not safe(video_path):
        return []
    clips = extract(video_path)
    log = load_log()
    for clip in clips:
        log.setdefault('clips', []).append({'source': video_path, 'clip': clip})
    save_log(log)
    return clips


def main() -> None:
    import sys

    for video in sys.argv[1:]:
        process(video)


if __name__ == '__main__':
    main()
