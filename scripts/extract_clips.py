#!/usr/bin/env python3
"""Cut short clips from raw videos using FFmpeg, Whisper, and Google Vision.
Generates 2–12 second safe clips and logs lifecycle to public/mags-log.json.
"""

import os
import json
import uuid
import subprocess
import pathlib
from datetime import datetime

import openai
from google.cloud import vision

RAW_DIR = pathlib.Path('Raw')
CLIP_DIR = pathlib.Path('Clips')
LOG_PATH = pathlib.Path('public/mags-log.json')

openai.api_key = os.getenv('OPENAI_API_KEY')
vision_client = vision.ImageAnnotatorClient()


def load_log():
    try:
        return json.load(open(LOG_PATH))
    except Exception:
        return {"clips": []}


def save_log(data):
    json.dump(data, open(LOG_PATH, 'w'), indent=2)


def get_duration(path):
    result = subprocess.run(
        [
            'ffprobe',
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            str(path)
        ], capture_output=True, text=True, check=True
    )
    return float(result.stdout.strip())


def transcribe(path):
    with open(path, 'rb') as f:
        res = openai.Audio.transcribe('whisper-1', f)
    return res.get('text', '')


def safe(path):
    frame = subprocess.check_output([
        'ffmpeg', '-i', str(path), '-vframes', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'
    ])
    image = vision.Image(content=frame)
    res = vision_client.safe_search_detection(image=image)
    anno = res.safe_search_annotation
    return anno.adult < 3 and anno.violence < 3


def extract_segments(video):
    duration = get_duration(video)
    start = 0.0
    segments = []
    while start + 2 < duration:
        end = min(start + 12, duration)
        segments.append((start, end))
        start += 10
    return segments


def process_video(video):
    log = load_log()
    segments = extract_segments(video)
    CLIP_DIR.mkdir(exist_ok=True)
    for idx, (start, end) in enumerate(segments, start=1):
        clip_path = CLIP_DIR / f"{video.stem}_{idx}.mp4"
        subprocess.run([
            'ffmpeg', '-y', '-i', str(video), '-ss', str(start), '-to', str(end), '-c', 'copy', str(clip_path)
        ], check=True)
        if not safe(clip_path):
            clip_path.unlink(missing_ok=True)
            continue
        transcript = transcribe(clip_path)
        clip_id = str(uuid.uuid4())
        entry = {
            'id': clip_id,
            'source': video.name,
            'path': str(clip_path),
            'transcript': transcript,
            'status': 'cut',
            'timestamps': {'cut': datetime.utcnow().isoformat() + 'Z'}
        }
        log['clips'].append(entry)
    save_log(log)


def main():
    RAW_DIR.mkdir(exist_ok=True)
    for video in RAW_DIR.glob('*.mp4'):
        process_video(video)


if __name__ == '__main__':
    main()
