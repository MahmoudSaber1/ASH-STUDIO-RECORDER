# Third-party notices

Ash Studio Recorder is MIT-licensed. Installers also include:

- **Electron and Chromium**, under the MIT license and the licenses listed in
  `LICENSES.chromium.html`, which ships inside the app.
- **FFmpeg**, as a separate executable from the `ffmpeg-static` package. FFmpeg
  is licensed under the LGPL 2.1 or later, and these builds include GPL
  components, so the bundled binary is covered by the GPL. Its license and
  source information ship next to the binary as `ffmpeg.LICENSE` and
  `ffmpeg.README`, and FFmpeg source code is available at
  https://ffmpeg.org/download.html. The app runs FFmpeg as a separate process and
  does not link to it.
- **uiohook-napi** (MIT) for global mouse and keyboard hooks.
- **React**, **Zustand** and other npm packages listed in `package-lock.json`,
  under their respective licenses.
