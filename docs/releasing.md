# Releasing

Releases are built by GitHub Actions from version tags.

1. Push the repository to GitHub (the workflows need a GitHub remote).
2. Update `version` in `package.json` and commit.
3. Tag and push: `git tag v0.1.0 && git push origin v0.1.0`.
4. The **Release** workflow verifies the code (lint, typecheck, unit tests), then
   builds macOS Apple Silicon, macOS Intel and Windows on separate jobs and
   uploads installers and `SHA256SUMS-*.txt` to a **draft** release.
5. Install the drafts on real machines, run the manual checklist in
   [testing.md](testing.md), then publish the draft.

## Code signing

Builds are unsigned today, so users see Gatekeeper and SmartScreen warnings (see
[install.md](install.md)).

- **macOS:** an Apple Developer ID (paid membership) removes the warning after
  notarization. Remove `identity: '-'` from `electron-builder.yml`, add a
  `notarize` block, and set the `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`,
  `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID` repository secrets.
  Signed builds also keep macOS permissions across updates; ad-hoc builds may ask
  again after each update.
- **Windows:** free signing for open-source projects is available through the
  SignPath Foundation; Azure Trusted Signing is a low-cost paid option.

## Local builds

`npm run dist:dir` builds an unpacked app for the current machine. A full local
`npm run dist` builds installers; its final update-metadata step needs a GitHub
remote and fails without one, after the installers are already written to
`release/`.
