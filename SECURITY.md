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
