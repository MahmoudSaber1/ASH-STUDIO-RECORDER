# Uninstalling Ash Studio Recorder

Uninstalling removes the app. **Your recordings are never deleted**: they live in
their own folder, and you decide what to do with them.

## Optional first step: reset the app

In the app, open **Settings → Reset app → Reset and restart**. This deletes
preferences, setup progress, saved capture options and logs, then restarts the
app. Recordings are kept. Quit the app afterwards and continue below.

## macOS

1. Quit the app (menu bar icon → **Quit**, or ⌘Q).
2. Drag **Ash Studio Recorder** from **Applications** to the Trash.
3. To remove everything the app kept, if you skipped the reset:

   ```bash
   rm -rf ~/Library/Application\ Support/Ash\ Studio\ Recorder ~/Library/Logs/Ash\ Studio\ Recorder ~/Library/Preferences/com.ashstudio.recorder.plist ~/Library/Caches/com.ashstudio.recorder
   ```

4. To remove its entries from the Privacy & Security lists:

   ```bash
   tccutil reset All com.ashstudio.recorder
   ```

5. Recordings stay in `~/Movies/Ash Studio Recorder` (or the folder you chose).
   Delete that folder yourself if you no longer need them.

## Windows (installed)

1. Quit the app from its notification area icon.
2. Open **Settings → Apps → Installed apps**, find **Ash Studio Recorder**, and
   choose **Uninstall**.
3. The uninstaller removes the app, its shortcuts, and its settings and logs in
   `%APPDATA%\Ash Studio Recorder`.
4. Recordings stay in `Videos\Ash Studio Recorder`. Delete that folder yourself if
   you no longer need them.

## Windows (portable)

1. Quit the app and delete the portable `.exe`.
2. Delete `%APPDATA%\Ash Studio Recorder` to remove its settings and logs.

## What the app never leaves behind

The app installs no background services, startup items, drivers or browser
extensions. Global shortcuts and the tray icon exist only while it runs.
