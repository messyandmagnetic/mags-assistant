# Maggie TikTok Automation Overview

This document sketches the modular design for **Maggie**, a soul-led assistant that automates TikTok publishing.

## Modules
- `drive.ts` – Google Drive helpers (watch/rename/cleanup).
- `speech.ts` – emotion keyword extraction via Google Speech‑to‑Text.
- `sheets.ts` – logging to the *TikTok Strategy Tracker – Messy & Magnetic* sheet.
- `video.ts` – placeholder for rendering overlays, captions, hashtags.
- `uploader.ts` – posts or schedules videos through Browserless/Puppeteer.
- `telegram.ts` – Telegram alerts to Chanel.
- `flop.ts` – identifies low performing posts for retry.
- `trends.ts` – collects trending hashtags and sounds.
- `cleanup.ts` – Drive housekeeping and archiving.
- `maggie-tiktok.ts` – orchestrates the full workflow.

Each function currently contains TODOs so real API calls and rendering logic can be added safely.
