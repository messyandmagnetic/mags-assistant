#!/usr/bin/env python3
"""Match cut clips with daily TikTok sound and caption trends."""

import json
import random
import datetime
import pathlib
from typing import Dict, List

import requests

LOG_PATH = pathlib.Path('public/mags-log.json')


def load_log() -> Dict:
    if LOG_PATH.exists():
        return json.load(LOG_PATH.open())
    return {"clips": []}


def save_log(data: Dict) -> None:
    json.dump(data, LOG_PATH.open('w'), indent=2)


def fetch_trends() -> List[Dict[str, str]]:
    try:
        resp = requests.get('https://www.tiktok.com/api/trending/item_list/?count=30')
        data = resp.json()
        items = data.get('itemList', [])
        return [
            {
                'sound': it.get('music', {}).get('title', ''),
                'caption': it.get('desc', '')
            }
            for it in items
        ]
    except Exception:
        return []


def match() -> None:
    log = load_log()
    trends = fetch_trends()
    for clip in log.get('clips', []):
        if clip.get('status') == 'cut' and not clip.get('trend') and trends:
            trend = random.choice(trends)
            clip['trend'] = trend
            clip['status'] = 'matched'
            clip.setdefault('timestamps', {})['matched'] = datetime.datetime.utcnow().isoformat() + 'Z'
    save_log(log)


if __name__ == '__main__':
    match()
