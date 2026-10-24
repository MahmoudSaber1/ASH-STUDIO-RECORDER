# Ash Studio Recorder

An open-source, cross-platform screen recorder and editor for macOS and Windows — in the spirit of Screen Studio, built entirely with free and open tools.

**Status: pre-alpha.** Phase 1 (platform layer and permission onboarding) is complete. The recorder itself lands in Phase 2.

## The core idea

Never bake effects during recording. Save raw data, then replay and render it.

```
record                          edit                            export
┌──────────────────────┐        ┌──────────────────────┐        ┌──────────────────────┐
│ screen.webm          │        │                      │        │                      │
│ webcam.webm          │  ───▶  │  project.json        │  ───▶  │  canvas frame        │
│ audio tracks         │        │  + live canvas       │        │  → FFmpeg            │
│ events.json          │        │  preview             │        │  → MP4 / GIF / WebM  │
└──────────────────────┘        └──────────────────────┘        └──────────────────────┘
```

- **Raw screen video** is captured to its own file.
- **Raw webcam video** is captured separately.
- **Microphone and system audio** are captured independently.
- **The event log** stores mouse position, clicks, scroll, keystrokes, window bounds, and timestamps.
- **The project file** references the raw media and stores every editor decision.
- **The editor** rebuilds the frame live on a canvas from raw data plus project settings.
- **Export** renders that same canvas frame by frame and encodes it with FFmpeg.

Because effects are metadata, zoom, cursor, background, and face cam stay editable forever.

## Why this architecture

- Re-recording is never required to change a zoom or background.
- Preview and export share one renderer, so what you see is what you get.
- Projects stay small and portable.
- New effects can be added without touching the capture pipeline.

## Planned features

- Full screen, display, and window capture with multi-monitor support
- Separate webcam, microphone, and system audio tracks
- Global input tracking with a replayed, high-quality cursor
- Automatic zoom from click events, with spring easing and manual editing
- Cursor effects, click ripples, spotlight, and keystroke overlays
- Backgrounds, padding, rounded corners, shadows, and aspect-ratio presets
- Face cam layouts, shapes, and auto-hide during zoom
- Timeline editing: trim, split, delete, speed ramps, undo/redo
- Export to MP4 (H.264), GIF, and WebM, including hardware encoding

## Tech stack

| Area          | Choice                                                            |
| ------------- | ----------------------------------------------------------------- |
| Desktop shell | Electron                                                          |
| UI            | React + TypeScript + Vite                                         |
| State         | Zustand                                                           |
| Styling       | Tailwind CSS + Radix UI                                           |
| Capture       | `desktopCapturer`, `getUserMedia`, `MediaRecorder`                |
| Input hooks   | `uiohook-napi`                                                    |
| Rendering     | Canvas 2D / WebGL (optionally PixiJS)                             |
| Encoding      | FFmpeg via `ffmpeg-static`                                        |
| Packaging     | electron-builder                                                  |
| CI / releases | GitHub Actions + GitHub Releases                                  |

## Getting started

Requirements:

- Node.js **22.22.1** or newer (`.nvmrc` pins 24; `npm install` is engine-strict)
- npm 10 or newer
- macOS 13+ or Windows 10+

```bash
npm install
npm run dev
```

### Scripts

| Command                | Description                                     |
| ---------------------- | ----------------------------------------------- |
| `npm run dev`          | Start Electron with Vite HMR                    |
| `npm run build`        | Typecheck and bundle main, preload, and renderer |
| `npm start`            | Preview the production bundle                   |
| `npm run typecheck`    | Typecheck the Node and web projects             |
| `npm run lint`         | ESLint over the whole repo                      |
| `npm run lint:fix`     | ESLint with autofix                             |
| `npm run format`       | Prettier write                                  |
| `npm run format:check` | Prettier check (used in CI)                     |

### Project structure

```
src/
├── main/                     # Electron main process
│   ├── index.ts              # Lifecycle, single instance lock
│   ├── window.ts             # Main window and navigation guards
│   ├── ipc/                  # Typed IPC handlers and validation
│   └── platform/             # PlatformService implementations
│       ├── base.ts           # Sources, cursor, shared helpers
│       ├── darwin.ts         # macOS permissions and privacy panes
│       ├── win32.ts          # Windows capabilities and settings links
│       ├── linux.ts          # Best-effort fallback
│       ├── service.ts        # PlatformService contract
│       └── index.ts          # Platform selection
├── preload/                  # Context-isolated bridge exposed to the renderer
│   ├── index.ts
│   └── api.d.ts
├── renderer/                 # React application
│   ├── index.html
│   └── src/
│       ├── components/
│       ├── lib/
│       ├── screens/
│       ├── stores/           # Zustand stores
│       ├── App.tsx
│       ├── main.tsx
│       └── styles/
└── shared/                   # Types and IPC contracts shared across processes
    ├── app.ts
    ├── ipc.ts
    └── platform.ts
```

Path aliases: `@main/*`, `@renderer/*`, and `@shared/*`.

### Platform layer

The main process selects a `PlatformService` at startup: macOS, Windows, or a best-effort Linux fallback. It reports permission state, opens the right system privacy pane, lists screens and windows, and returns the cursor position. The renderer can only reach it through typed IPC channels declared in `src/shared/ipc.ts`.

Permission handling, deep links, and platform differences are documented in [`docs/platform.md`](docs/platform.md).

## Roadmap

| Phase | Scope                                            | Status |
| ----- | ------------------------------------------------ | ------ |
| 0     | Project setup, tooling, CI                       | Done   |
| 1     | Platform abstraction and permissions             | Done   |
| 2     | Recorder MVP (capture, input events, raw files)  | Next   |
| 3     | Project system and library                       |        |
| 4     | Editor foundation and timeline                   |        |
| 5     | Auto zoom and camera motion                      |        |
| 6     | Cursor effects                                   |        |
| 7     | Backgrounds and styling                          |        |
| 8     | Face cam                                         |        |
| 9     | Audio                                            |        |
| 10    | Export pipeline                                  |        |
| 11    | Performance and reliability                      |        |
| 12    | UX polish                                        |        |
| 13    | Testing                                          |        |
| 14    | Packaging and release                            |        |
| 15    | Open-source launch                               |        |
| 16    | Post-launch ideas                                |        |

See [`docs/architecture.md`](docs/architecture.md) for the full design notes and known risks.

## Contributing

Contributions are welcome. Read [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) first.

## License

[MIT](LICENSE)
