# 四季之樹・靜心 Season Tree

A three.js four-season tree for breathing and relaxation: breathing guide, meditation timer, procedurally synthesised ambience and white noise, day/night, records.

- **Web / PWA**: a static site served from the repo root (no build step), deployable straight to Vercel.
- **Android**: packaged with Capacitor 8 (`android/`). Native features: background sound playback (foreground service), haptics, a daily reminder notification, keeping the screen on during a session, and full offline use.

The web version's first release (v1) is kept as the `v1.0-web` tag / `web-v1` branch.

## Files

| File | Contents |
|---|---|
| `core.js` | shared renderer, camera, wind, day/night and breathing state, scene switching (the `world` API) |
| `tree.js` | 四季之樹 scene (seasons, falling leaves) |
| `scenes/` | 海邊潮汐 `sea.js`, 海邊觀景台 `overlook.js`, 燈塔 `lighthouse.js`, 深海鯨歌 `whale.js`, 蓮花池 `lotus.js`, 雨窗 `rain.js`, 雪夜小屋 `snow.js`, 燭光 `candle.js`, 營火 `camp.js`, 極光星空 `aurora.js`; shared tools `common.js` (sky, stars, ocean, gulls, flame, sparks, pines) |
| `audio.js` | Web Audio engine: 17 synthesised sounds, presets, singing bowl / cue chimes, background pre-scheduling |
| `app.js` | UI, meditation flow, settings and records (localStorage) |
| `native.js` | Capacitor plugin bridge; every call falls back to a web API on the web |
| `vendor/three/` | three@0.170.0 (local, works offline) |

## Building the Android APK

Requires Node 18+, JDK 21 and the Android SDK (platform 36).

```bash
npm install
npm run sync            # copy the web app into www/ and sync it into android/
cd android && ./gradlew assembleDebug
```

The APK is at `android/app/build/outputs/apk/debug/app-debug.apk`.
Icons and the splash screen are regenerated with `python scripts/make_icons.py`; UI/scene icons are cut from Gemini sheets with `scripts/cut_icons.py`.
