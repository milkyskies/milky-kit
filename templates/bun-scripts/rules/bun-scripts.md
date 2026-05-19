# Bun scripts

Personal-scale scripting project, not a deployed app. Conventions:

- **Runtime is Bun.** Use `Bun.file`, `Bun.write`, `Bun.$`, and built-in `fetch` instead of pulling Node libraries when an equivalent exists.
- **Run scripts directly.** `bun run src/scripts/<name>.ts` — no build step, no `tsx`, no `ts-node`.
- **`src/scripts/` is for entry points.** Each file is independently runnable. Top-level `await` is fine; the file is the program.
- **`src/lib/` is for shared helpers.** Imported via the `@/lib/*` path alias.
- **One concern per script.** If a script grows past one screen of orchestration, lift the logic into `src/lib/` and keep the script as glue.
- **No CLI framework.** Parse `Bun.argv` directly. If you need flags, use Bun's built-in `parseArgs` (from `node:util`).
- **`.env` is loaded automatically by Bun** — read via `process.env.FOO`. No `dotenv` import.
