# Testing

## Automated

| Command | What it covers |
| --- | --- |
| `npm test` | Vitest unit and integration tests: project schema and migrations, timeline and segment math, zoom and spring easing, cursor interpolation, event log parsing, video-to-clock sync, editing commands, output sizing, project store (against temp folders), FFmpeg argument building. |
| `npm run build && npm run test:e2e` | Playwright against the built Electron app: library, editor, zoom detection, playback, split, select and delete, undo, autosave, MP4 export checked with FFmpeg, and the settings screen. |
| `ASH_E2E_APP=<path to packaged binary> npm run test:e2e` | The same E2E suite against a packaged build, to check the shipped artifact. |

The E2E suite generates its own project folder (`e2e/make-fixture.mjs`) and sets
`ASH_RECORDINGS_DIR`, so it never touches your real recordings. Native save and open
dialogs are replaced with fixed paths inside the test.

## Manual checklist

Run these on each platform before a release. Recording needs real hardware, so the
automated suite cannot cover it.

### macOS

- [ ] First launch shows the system check. Screen Recording and Accessibility are
      requested, and the app asks to restart after granting them.
- [ ] Record one minute with pause and resume. Stop it with the floating bar and with ⌘⇧S.
- [ ] The floating bar does not appear in the recording.
- [ ] The cursor is not visible in the captured video (`cursor: never`).
- [ ] In the editor, the video length matches the timeline, and the cursor overlay
      lines up with the real pointer. Check this after a pause: the video and the
      events must stay in sync.
- [ ] Close the recorder window during a recording. It hides, and the recording continues.
- [ ] Quit with ⌘Q during a recording. The recording is saved before the app exits.
- [ ] With Accessibility off, the recorder shows a warning and records without cursor data.
- [ ] Export MP4 at 1080p with the microphone. Play it back and check audio sync.
- [ ] Export GIF and WebM. Check the file opens.
- [ ] Hardware encoder (VideoToolbox) produces a playable MP4.

### Windows

- [ ] Recording a display and a window works without a permission prompt.
- [ ] System audio is recorded when the option is on. Otherwise a warning explains it.
- [ ] The floating bar does not appear in the recording (content protection).
- [ ] Multi-monitor: the display labels match the real layout, including scale factor.
- [ ] Export MP4 with the hardware encoder (NVENC) on a machine that has it, and with the
      software encoder on one that does not.
- [ ] The tray icon starts and stops recordings from its menu.

### Both

- [ ] Force-quit during a recording. On the next launch, the project opens as
      "Partial" and its media plays.
- [ ] Rename, duplicate, and move a project to Trash. The Trash copy restores.
- [ ] Import an exported project folder into a new library.
- [ ] Change the recordings folder in Settings. New recordings go there, and old
      projects still open.
