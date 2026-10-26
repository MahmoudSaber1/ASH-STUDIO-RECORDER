# Security policy

Ash Studio Recorder records screens and microphones, so security and privacy bugs matter.

## Supported versions

The project is pre-alpha. Only the latest commit on `main` receives security fixes.

## Reporting a vulnerability

Please do **not** open a public issue for security problems. Use GitHub's private vulnerability reporting on the repository (Security → Report a vulnerability) and include:

- A description of the issue and its impact
- Steps to reproduce, or a proof of concept
- Affected platform and version
- Any suggested fix

You can expect an initial response within a few days. Once a fix is available, we will publish an advisory and credit you unless you prefer to stay anonymous.

## Scope

In scope:

- Sandbox or context-isolation escapes in the Electron shell
- Arbitrary code execution through a project file, media file, or IPC channel
- Leaking captured screen, camera, or microphone data
- Path traversal or arbitrary file writes
- Bypassing permission checks

Out of scope:

- Vulnerabilities in third-party binaries that require an upstream fix (report them upstream, but tell us too)
- Social engineering
- Issues that require an already-compromised machine

## Design commitments

- No telemetry, analytics, or remote logging.
- Captures and project data stay on the local disk.
- The renderer is context-isolated and never receives raw Node APIs.
- New IPC channels are typed and validated in the main process.

## Security model

The app records sensitive content, so the shell is locked down:

- Every window runs with context isolation, the renderer sandbox, and no Node.js
  integration. Pages reach the main process only through a typed preload API.
- The main process accepts IPC only from the app's own top-level pages and
  validates every argument. Project media is served through a custom protocol that
  only returns files a project lists, with path traversal blocked.
- Navigation to other origins, new windows and `<webview>` are blocked. The only
  permissions granted are camera, microphone and screen capture, and only to the
  app's own pages.
- Production builds use a strict Content Security Policy with no inline scripts.
- Electron fuses disable `ELECTRON_RUN_AS_NODE`, `NODE_OPTIONS` and `--inspect`,
  and the app only loads from its own asar archive, checked against an embedded
  hash.
- The app makes no network connections and has no telemetry.

## Verifying releases

Only download from the project's GitHub Releases. Each release publishes SHA-256
checksums; see [docs/install.md](docs/install.md#verify-your-download). Builds are
produced by GitHub Actions from tagged commits, so every installer can be traced
to its source.
