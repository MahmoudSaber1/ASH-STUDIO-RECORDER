# Roadmap status

Status of each phase in the architecture roadmap, as of the last update.

| Phase | Status | Notes |
| --- | --- | --- |
| 0 — Project setup | Done | Lint, format, typecheck, unit tests and CI. |
| 1 — Platform layer | Done | macOS and Windows implementations, typed IPC, permission onboarding. |
| 2 — Recorder | Done, needs device testing | Capture, cursor and key events, crash-safe chunks, recovery, stop-and-save. System audio on Windows is untested on hardware. |
| 3 — Project system | Done | Schema v2 with migrations, library with thumbnails, rename, duplicate, Trash, autosave, import and export as folder bundles. Bundles are folders, not zip files. |
| 4 — Editor foundation | Done | Preview, timeline, trim, cuts, split, speed ramps, undo and redo, idle speed-up. |
| 5 — Auto zoom | Done | Click clusters, spring easing, follow cursor, manual segments, sensitivity. Per-segment easing choice is not exposed. |
| 6 — Cursor effects | Done | Smoothing, size, ripples, highlight, keystroke overlay. Cursor overlays need display captures. |
| 7 — Backgrounds | Done | Solid and gradient, padding, radius, shadow, aspect presets. Wallpaper presets and image backgrounds are not included. Vertical reframe is the 9:16 preset. |
| 8 — Face cam | Partly done | Shapes, position, size, mirror, border, hide while zoomed. Background blur or removal (MediaPipe) is not included. |
| 9 — Audio | Partly done | Waveform, microphone volume, fades. Noise reduction (RNNoise) is not included. System audio is not mixed in the editor. |
| 10 — Export | Done | MP4, WebM, GIF; resolutions; 30 and 60 fps; progress and cancel; hardware option. GIF has no palette pass. |
| 11 — Performance | Partly done | Remux for seeking, range-served media, back-pressured export, local logs. Proxy previews and worker-based rendering are not done. |
| 12 — UX polish | Partly done | Keyboard shortcuts, settings, tray menu. Light theme, full localization (English and Arabic), and first-run tour are not done. |
| 13 — Testing | Done | Vitest, Playwright E2E, manual checklist in `docs/testing.md`. |
| 14 — Packaging | Done for unsigned builds | electron-builder config for macOS (dmg, zip, arm64 and x64) and Windows (NSIS, portable). Release workflow on tags. Code signing and notarization need certificates. |
| 15 — Open source launch | Partly done | README, templates, landing page source in `site/`. Demo video and GIF need a real recording. |
| 16 — Post-launch ideas | Not started | Presets marketplace, Whisper captions, annotations, mobile recording, plugin system. |
