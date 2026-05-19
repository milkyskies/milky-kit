---
paths:
  - "package.json"
  - "bunfig.toml"
  - "bun.lockb"
---

# Bun workspace conventions

For projects where Bun is the runtime AND the package manager (typical for Bun-runtime backends, single-app projects, scripts). Multi-app monorepos with a React frontend usually want `modules/pnpm` instead — pnpm's workspace ergonomics are still more mature.

## Install + scripts

- `bun add <package>` to add deps. Never edit `package.json` by hand.
- `bun install --frozen-lockfile` in CI.
- `bun.lockb` is committed (binary lockfile — that's the Bun convention).
- Workspace packages declared via `workspaces` in root `package.json`. Run a script across all: `bun --filter '*' run typecheck`.

## Runtime conventions

- Use `Bun.file`, `Bun.write`, `Bun.$`, built-in `fetch` instead of pulling Node libraries when an equivalent exists.
- `.env` loads automatically — read via `process.env.X`. No `dotenv` import.
- Bun runs TS directly; no build step, no `tsx`, no `ts-node`.
- CLI flags: `parseArgs` from `node:util`, or `Bun.argv` for simple cases.

## Worktrees

Bun's lockfile is binary, so worktrees may share `node_modules` only if they're at the same lockfile state. Run `bun install` after switching worktrees if anything in `package.json` has changed.

## Bun vs Node compatibility

Most Node-compatible packages work, but check the [Bun compatibility list](https://bun.sh/docs/runtime/nodejs-apis) before assuming. Anything using native Node addons (`node-gyp`) is risky. Effect-TS, Drizzle, `@effect/platform-bun` all work natively.
