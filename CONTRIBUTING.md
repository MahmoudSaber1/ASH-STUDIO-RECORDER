# Contributing to Ash Studio Recorder

Thanks for helping build Ash Studio Recorder. This project is pre-alpha, so APIs and file formats will change. If you plan a large change, open an issue first so we can agree on the approach.

## Setup

```bash
git clone <repository-url>
cd ash-studio-recorder
nvm use            # or install Node 22.22.1+
npm install
npm run dev
```

`npm install` runs Husky. Git hooks are required for contribution.

## Development workflow

1. Fork the repo and create a branch:
   - `feat/short-description`
   - `fix/short-description`
   - `chore/short-description`
   - `docs/short-description`
2. Make focused commits following [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat(recorder): capture window sources`
   - `fix(editor): keep playhead in sync after trim`
   - `docs: document project file format`
3. Keep the diff small and scoped. Separate refactors from behaviour changes.
4. Run the checks before pushing:

```bash
npm run lint
npm run format:check
npm run typecheck
npm run build
```

## Code style

- TypeScript strict mode is on. Avoid `any`; prefer precise types and `unknown` at boundaries.
- Use function components and hooks in the renderer.
- Keep main-process code free of UI concerns and keep renderer code free of Node APIs.
- Add new IPC channels to `src/shared/ipc.ts` first, then wire main and preload. Never expose raw `ipcRenderer` to the renderer.
- Prefer small modules over large files.
- Comments should explain why, not what. No commented-out code.
- Do not bake visual effects into captured media. Effects belong to the project file and renderer.

Formatting is handled by Prettier and linting by ESLint. Hooks run both on changed files.

## Platform testing

Changes that touch capture, permissions, input hooks, or windows must be checked on both macOS and Windows where possible. Note in the PR which platforms you tested, plus display configuration and DPI scale.

## Pull requests

A good PR includes:

- What changed and why
- Screenshots or a short clip for UI changes
- Test notes and platforms covered
- Linked issue, if one exists

Maintainers may ask for tests. Unit tests will use Vitest; end-to-end tests will use Playwright once the editor exists.

## Security and privacy

- Never commit secrets, signing certificates, or tokens.
- Do not add telemetry, analytics, or remote logging. Crash logs stay local.
- Report vulnerabilities privately as described in [`SECURITY.md`](SECURITY.md).

## License

By contributing, you agree that your contributions are licensed under the MIT License.
