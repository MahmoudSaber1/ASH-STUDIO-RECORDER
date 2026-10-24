# Platform layer

The platform layer isolates every OS-specific concern behind one interface. The renderer never talks to Electron directly; it calls typed IPC channels, and the main process delegates to the current `PlatformService`.

## Contract

Defined in `src/main/platform/service.ts`:

| Method                     | Purpose                                          |
| -------------------------- | ------------------------------------------------ |
| `capabilities`             | Static flags the UI uses to adapt                |
| `getPermissions()`         | Current permission state for every relevant kind |
| `requestPermission(kind)`  | Prompt if possible, otherwise open system settings |
| `openPermissionSettings()` | Open the correct OS privacy pane                 |
| `getSources(options)`      | Screen and window capture sources, with thumbnails |
| `listWindows()`            | Window sources only, without thumbnails          |
| `getCursorPosition()`      | Global cursor position in screen coordinates     |

DTOs live in `src/shared/platform.ts` and are serialisable, so they cross IPC unchanged.

Implementations:

- `darwin.ts` — macOS (primary target)
- `win32.ts` — Windows (primary target)
- `linux.ts` — best-effort fallback, not officially supported yet
- `base.ts` — shared `desktopCapturer`, cursor, and mapping logic

Selection happens in `src/main/platform/index.ts` based on `process.platform`.

## Permission matrix

| Permission    | macOS                                                                 | Windows                                                       |
| ------------- | --------------------------------------------------------------------- | ------------------------------------------------------------- |
| Screen        | TCC Screen Recording (`getMediaAccessStatus('screen')`). Requires restart after granting. | No permission required. `desktopCapturer` works directly.     |
| Accessibility | TCC Accessibility (`isTrustedAccessibilityClient`). Required for global input hooks. | Not required for global hooks.                                 |
| Camera        | TCC Camera. `askForMediaAccess('camera')` prompts while not determined. | Windows privacy setting; opened via `ms-settings:privacy-webcam`. |
| Microphone    | TCC Microphone. `askForMediaAccess('microphone')` prompts while not determined. | Windows privacy setting; opened via `ms-settings:privacy-microphone`. |

macOS privacy panes use the `x-apple.systempreferences` URL scheme:

- `Privacy_ScreenCapture`
- `Privacy_Accessibility`
- `Privacy_Camera`
- `Privacy_Microphone`

On Windows, screen capture has no consent gate. Camera and microphone are controlled by Windows privacy settings, and `getMediaAccessStatus` can report `granted` even when desktop app access is blocked, so capture errors in Phase 2 must fall back to a "check Windows privacy settings" message.

## Flows

### Screen recording (macOS)

1. Status is `not-determined` on first launch.
2. Clicking **Grant access** calls `desktopCapturer.getSources` once, which triggers the OS prompt.
3. If the user denies it, the only way back is System Settings. The UI opens `Privacy_ScreenCapture` and explains that the app must be restarted.
4. While status is `denied`, the app does not call `getSources`, because that would fail and can re-prompt unnecessarily.

### Accessibility (macOS)

`isTrustedAccessibilityClient(true)` asks macOS to show the accessibility prompt, then the UI opens `Privacy_Accessibility`. Global hooks stay disabled until the app is restarted with the permission granted.

### Camera and microphone

macOS prompts through `askForMediaAccess`. If already denied, the request opens the matching privacy pane. Windows has no prompt API; the request opens the matching `ms-settings:` page.

## IPC and validation

Channels are declared in `src/shared/ipc.ts` with an `IpcContract` mapping args to results. `src/main/ipc/handle.ts` enforces that contract at registration time, and `src/preload/index.ts` exposes only the `StudioApi` surface.

Main-process validation:

- Permission kinds are checked against an allowlist before reaching a service.
- Source options are rebuilt from scratch; unknown fields are dropped.
- Thumbnail dimensions are rounded and clamped to 0–1024.
- Only `screen` and `window` source kinds are accepted.

The preload bridge exposes no raw `ipcRenderer`, no Node APIs, and no arbitrary channel names.

## Adding a platform

1. Implement `PlatformService` (usually by extending `BasePlatformService`) in a new file.
2. Return accurate `capabilities` and a `PermissionState[]` in a stable order.
3. Open only an allowlisted privacy URL; return `false` if the OS has none.
4. Register the service in `createPlatformService()`.
5. Add permission copy and guidance in `src/renderer/src/lib/permissions.ts`.
6. Verify that source ids, thumbnails, and cursor coordinates round-trip correctly.

## Input hooks

Phase 2 adds `uiohook-napi` to the main process. The capability flag `supportsGlobalInputHooks` and the macOS Accessibility permission are already in place. Hook events will be normalised in main and streamed to the renderer with timestamps relative to the capture epoch; they are not exposed through this phase's IPC contract yet.

## Known limitations

- macOS requires a restart after screen recording or accessibility is granted.
- Development builds are unsigned, so moving the app bundle can reset TCC grants. Re-add the app in System Settings if permissions appear granted but capture fails.
- Windows window enumeration includes hidden and untitled windows; filtering belongs to the Phase 2 source picker.
- Linux screen capture depends on the compositor and portal implementation.
