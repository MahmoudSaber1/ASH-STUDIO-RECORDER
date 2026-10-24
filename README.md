# Ash Studio Recorder

An open-source, cross-platform screen recorder and editor for macOS and Windows — in the spirit of Screen Studio, built entirely with free and open tools.

**Status: pre-alpha.** Recording, the project library, the editor and export all work end to end. Some items are still open. See [docs/roadmap.md](docs/roadmap.md).

## The core idea

Never bake effects during recording. Save raw data, then replay and render it.

```
record                          edit                            export
┌──────────────────────┐        ┌──────────────────────┐        ┌──────────────────────┐
│ screen.webm          │        │                      │        │                      │
│ webcam.webm          │  ───▶  │  project.json        │  ───▶  │  canvas frame        │
│ audio tracks         │        │  + live canvas       │        │  → FFmpeg            │
│ events.jsonl         │        │  preview             │        │  → MP4 / GIF / WebM  │
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

| Command                | Description                                              |
| ---------------------- | -------------------------------------------------------- |
| `npm run dev`          | Start Electron with Vite HMR                             |
| `npm run build`        | Typecheck and bundle main, preload, and renderer         |
| `npm start`            | Preview the production bundle                            |
| `npm test`             | Vitest unit and integration tests                        |
| `npm run test:e2e`     | Playwright suite against the built app (run `build` first) |
| `npm run dist:dir`     | Build an unpacked app for local checks                    |
| `npm run dist`         | Build installers with electron-builder                    |
| `npm run typecheck`    | Typecheck the Node and web projects                      |
| `npm run lint`         | ESLint over the whole repo                               |
| `npm run format:check` | Prettier check (used in CI)                              |

Manual test steps for macOS and Windows are in [`docs/testing.md`](docs/testing.md).

### Where your data lives

Each recording is a folder: `project.json` (settings and editor state), the raw
`.webm` tracks, `events.jsonl` (cursor and key events), and an optional
`thumbnail.jpg`. By default folders go to `Videos/Ash Studio Recorder`. Change it
in Settings. Warnings and errors are written to `main.log` in the app's logs folder.

### Keyboard shortcuts

| Shortcut              | Action                            |
| --------------------- | --------------------------------- |
| ⌘⇧R / Ctrl⇧R          | Start recording                   |
| ⌘⇧P / Ctrl⇧P          | Pause or resume                   |
| ⌘⇧S / Ctrl⇧S          | Stop recording                    |
| Space                 | Play or pause in the editor       |
| S                     | Split at the playhead             |
| Delete / Backspace    | Remove the selected time          |
| ⌘Z / ⇧⌘Z              | Undo and redo                     |

### Project structure

```
src/
├── main/                     # Electron main process
│   ├── index.ts              # Lifecycle, single instance lock, quit-after-save
│   ├── window.ts             # Main and toolbar windows, close guard
│   ├── tray.ts               # Menu bar and notification area entry
│   ├── settings.ts           # User preferences (recordings folder)
│   ├── logger.ts             # Local main.log
│   ├── ipc/                  # Typed IPC handlers and validation
│   ├── media/                # ash-media protocol, FFmpeg remux and export
│   ├── projects/store.ts     # Project library file operations
│   ├── recorder/             # Capture manager, writers, recovery, input hooks
│   └── platform/             # PlatformService implementations
├── preload/                  # Context-isolated bridge exposed to the renderer
├── renderer/src/
│   ├── components/           # Shared UI, timeline, preview, inspector, export dialog
│   ├── lib/                  # Frame renderer, media loader, exporter, thumbnails
│   ├── screens/              # Record, library, editor, settings, setup
│   └── stores/               # Zustand stores: editor, recorder, navigation, platform
└── shared/                   # Pure logic and types used by every process
    ├── project.ts            # Schema v2, migrations, editor defaults
    ├── timeline.ts           # Trim, cuts, speed ramps, time mapping
    ├── zoom.ts               # Click clusters, spring easing, camera
    ├── cursor.ts             # Interpolation, smoothing, ripples
    ├── editing.ts            # Editing commands
    └── __tests__/            # Unit tests

e2e/                          # Playwright suite and fixture generator
docs/                         # Architecture, platform notes, testing, roadmap
site/                         # Landing page source
```

Path aliases: `@main/*`, `@renderer/*`, `@shared/*`.

### Platform layer

The main process selects a `PlatformService` at startup: macOS, Windows, or a best-effort Linux fallback. It reports permission state, opens the right system privacy pane, lists screens and windows, and returns the cursor position. The renderer can only reach it through typed IPC channels declared in `src/shared/ipc.ts`.

Permission handling, deep links, and platform differences are documented in [`docs/platform.md`](docs/platform.md).

## Roadmap

Phase-by-phase status, including what is not done yet, is in [`docs/roadmap.md`](docs/roadmap.md).

See [`docs/architecture.md`](docs/architecture.md) for the full design notes and known risks.

## Contributing

Contributions are welcome. Read [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) first.

## License

[MIT](LICENSE)
