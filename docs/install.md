# Installing Ash Studio Recorder

Download installers only from the project's **GitHub Releases** page. Each release
lists a SHA-256 checksum for every file, so you can check that a download was not
altered (see [Verify your download](#verify-your-download)).

| Platform | File | Notes |
| --- | --- | --- |
| macOS, Apple Silicon (M1 and later) | `Ash-Studio-Recorder-<version>-mac-arm64.dmg` | macOS 13 or later |
| macOS, Intel | `Ash-Studio-Recorder-<version>-mac-x64.dmg` | macOS 13 or later |
| Windows 10 and 11 | `Ash-Studio-Recorder-<version>-windows-setup.exe` | Installer with uninstaller |
| Windows, no install | `Ash-Studio-Recorder-<version>-windows-portable.exe` | Runs from any folder |

## macOS

1. Open the `.dmg` and drag **Ash Studio Recorder** to **Applications**.
2. Open the app once. macOS blocks it the first time, because the app is not yet
   signed with a paid Apple Developer certificate. This is expected for this
   pre-release.
3. Open **System Settings → Privacy & Security**, scroll down, and click
   **Open Anyway** next to the message about Ash Studio Recorder. Confirm with
   your password.

   If you prefer the Terminal, this removes the download flag instead:

   ```bash
   xattr -dr com.apple.quarantine "/Applications/Ash Studio Recorder.app"
   ```

4. The first-run setup asks for these permissions:
   - **Screen Recording** (required) to capture your screen.
   - **Accessibility** (required) to record cursor movement and clicks.
   - **Camera** and **Microphone** (optional), only when you turn them on.

   After you grant Screen Recording or Accessibility, click **Restart app** in the
   setup screen. macOS applies them only after a restart.

## Windows

1. Run the setup `.exe`. Windows SmartScreen may say "Windows protected your PC",
   because the installer is not code-signed yet. Click **More info**, then
   **Run anyway**.
2. Choose where to install. Shortcuts are added to the Start menu and desktop.
3. Windows does not ask for screen permission. Camera and microphone access follow
   **Settings → Privacy & security → Camera / Microphone**.

The portable `.exe` needs no installation and stores its settings in your user
profile like the installed app.

## Verify your download

Each release has `SHA256SUMS-*.txt` files. Compare the value for your file:

```bash
shasum -a 256 ~/Downloads/Ash-Studio-Recorder-*.dmg
```

On Windows, in PowerShell:

```powershell
Get-FileHash .\Ash-Studio-Recorder-*-windows-setup.exe -Algorithm SHA256
```

If the value does not match the release page, delete the file and do not open it.

## Where things are stored

| What | macOS | Windows |
| --- | --- | --- |
| Recordings (your projects) | `~/Movies/Ash Studio Recorder` (changeable in Settings) | `Videos\Ash Studio Recorder` |
| Settings and local state | `~/Library/Application Support/Ash Studio Recorder` | `%APPDATA%\Ash Studio Recorder` |
| Logs | `~/Library/Logs/Ash Studio Recorder` | `%APPDATA%\Ash Studio Recorder\logs` |

To remove the app, see [uninstall.md](uninstall.md).
