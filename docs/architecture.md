# Architecture

## Principle

Never bake effects during recording. Capture raw inputs, store them, and rebuild every frame at edit time.

This is the decision everything else follows from. A recording is not a video with effects applied; it is a media set plus an event timeline plus a project that describes how to interpret them.

## Capture pipeline (Phase 2)

The main process owns capture and disk I/O. The renderer owns preview only.

1. **Sources** — `desktopCapturer` lists screens and windows. The user picks one.
2. **Screen stream** — `getUserMedia` with `chromeMediaSource: 'desktop'`, captured by `MediaRecorder`.
3. **Webcam stream** — a separate `getUserMedia` stream and `MediaRecorder`, written to its own file.
4. **Audio** — microphone stream plus system audio where the platform supports it, each recorded independently.
5. **Input events** — `uiohook-napi` runs in the main process and appends timestamped mouse, keyboard, and scroll events to `events.jsonl`.
6. **Sync** — all timestamps are relative to a single capture epoch taken before the first frame. Video and event offsets are stored in the project manifest.
7. **Crash safety** — media is written in time-sliced chunks to `.webm.part` files and only renamed to `.webm` when the session is finalized. The event log is append-only. On the next launch, any unfinished session is recovered: its `.part` files are promoted to `.webm`, its manifest is marked `incomplete`, and a note explains what happened.
8. **Stop and save** — the capture window hands back its last chunks after stop. If it never does (closed, reloaded, or crashed), the main process saves what it already has after a short grace period, so a session never stays stuck in "stopping". Closing the recorder window during a session hides it instead, and quitting waits for the save to finish.

The system cursor is hidden in the captured video. The cursor you see in the editor and export is drawn from event data, which is what makes size, style, smoothing, and click ripples editable.

## Project layout on disk

```
My Recording/
├── project.json      # schema version, editor settings, media references, offsets
├── screen.webm       # raw screen capture
├── webcam.webm       # raw camera capture (optional)
├── microphone.webm   # microphone (optional)
├── system-audio.webm # system audio, Windows only (optional)
├── events.jsonl      # append-only input event log
└── (thumbnails/)     # planned: cached previews, not written yet
```

## Editing pipeline (Phases 4–8)

- The editor decodes raw media into a `<video>` element and drives a requestAnimationFrame loop.
- A frame renderer draws, in order: background → screen frame with padding and rounding → face cam → cursor and effects → overlays.
- Current time is the source of truth. The cursor position at time `t` is derived from the event log with interpolation, not from the video.
- Zoom is a list of segments on the timeline. Auto zoom proposes segments from click events; the user can add, move, resize, and delete them.
- Zoom changes are applied as a camera transform on the screen layer, with spring easing and a cursor dead zone.
- All editor state lives in the project file, so any effect is reversible.

## Export pipeline (Phase 10)

1. Create an offscreen canvas at the target resolution.
2. For each output frame, seek the source media to the matching time, render the scene, and read the canvas pixels.
3. Pipe raw RGBA frames to FFmpeg over stdio, or encode via a worker if piping is too slow.
4. Encode with H.264 (VideoToolbox, NVENC, or QSV where available), WebM, or GIF.
5. Report progress per frame; allow cancellation and background rendering.

Preview and export must use the same renderer function so previews stay trustworthy. Differences are limited to resolution and quality settings.

## Process boundaries

| Process  | Responsibilities                                                       |
| -------- | ---------------------------------------------------------------------- |
| Main     | Windows, capture sources, permissions, input hooks, filesystem, FFmpeg |
| Preload  | A small typed API over `ipcRenderer`; no raw Node access               |
| Renderer | React UI, canvas preview, timeline, project state                      |

New IPC goes through `src/shared/ipc.ts` so main, preload, and renderer share one contract. The renderer never gets `ipcRenderer` itself.

## Biggest technical risks

- **Cursor fidelity** — hiding the OS cursor and replaying it accurately at the right size and position.
- **Timestamp sync** — keeping event timestamps locked to video frames across pause, resume, and variable frame timing.
- **Preview performance** — 60 fps preview with zoom, blur, and overlays on long recordings.
- **Export speed** — frame-accurate rendering of long videos, and hardware encoder differences between platforms.
- **Platform permissions and hooks** — macOS screen recording and accessibility flows, and Windows hook reliability.
