---
name: retrofit
description: Apply milky-kit conventions to an EXISTING project. Use when the user wants to add the kit's CI workflows, supply-chain security, biome config, ghlobes task tracking, CLAUDE.md rules, or @effect/vitest setup to a repository that already has code. Detects the current stack and merges rather than overwrites.
---

# Apply milky-kit to an existing repo

Use this skill when the user has a working project and wants to layer in some or all of milky-kit's conventions without restarting. The skill detects the stack, asks which modules to add, and merges instead of overwriting — so existing config, code, and CLAUDE.md content survives.

## When to invoke

User says any of: "add milky-kit to this project", "set up CI like milky-kit", "retrofit", "/milky-kit:retrofit", "give this repo the kit's security workflows". If unsure between `new` and `retrofit`, ask whether the project is new or existing.

## Detect first, ask second

Before asking the user anything, scan the repo:

- `package.json` exists? → TS project. Which package manager? (`pnpm-lock.yaml`, `bun.lockb`, `package-lock.json`)
- `Cargo.toml` exists? → Rust project.
- `biome.json` exists? → record current config (may need migrating to extends `@milkyskies/biome-config`).
- `tsconfig.json` exists? → record path; may need extends bumping.
- `.github/workflows/` exists? → list current workflows; ask before adding `ci.yml` / `security.yml` if those names are already taken.
- `CLAUDE.md` exists? → read current `@`-refs; only append missing ones, don't duplicate.
- `.ghlobes.toml` exists? → ghlobes already wired; skip the ghlobes module's scaffold but still offer the rule ref.

Report findings briefly. Then ask which modules to apply.

## Inputs to gather

1. **Which composable modules to apply** (multi-select, only modules that make sense for the detected stack):
   - `ghlobes` — task tracking via GitHub Issues + Projects
   - `security` — runtime-neutral CI security workflow + rules
   - `ci` — CI scripts (check-package-scripts.sh)
   - `pnpm-security` (TS + pnpm only) — supply-chain controls
   - `bun-security` (TS + bun only)
   - `postgres` — docker-compose + rules
   - `biome` — switch to `@milkyskies/biome-config` extends

2. **Which template-level rule, if any**, applies. If the project is clearly an Effect-TS API, offer `templates/effect-api/rules/effect.md` as a CLAUDE.md ref. If clearly Hono / React / Axum, offer those. Don't prescribe a template if the project doesn't match cleanly — leave the template ref empty and the project owns its CLAUDE.md.

3. **Project-specific rules (tsuika)** — free text. Appended under `## Project-specific` in CLAUDE.md after the kit refs.

## Steps to execute

1. **Merge scaffold files** for each chosen module:
   - For `package.json`: deep-merge — add new deps + scripts without touching existing keys. If a script name collides (e.g. `lint` already defined), ask which to keep.
   - For `biome.json`: replace with `{ "$schema": "...", "extends": ["@milkyskies/biome-config"] }`, preserving any project-specific `files.includes` patterns from the old config.
   - For `tsconfig.json`: only update `extends` if the project doesn't already extend something the user cares about.
   - For `.github/workflows/*.yml`: skip if file exists; show diff and ask if they want to replace.
   - For `.ghlobes.toml`: skip if present.
   - For `CLAUDE.md`: append `@`-refs that aren't already there, under appropriate sections; never duplicate existing content.

2. **Add `.milky-kit-version`** if missing. Same format as the `new` skill — kit SHA + timestamp + applied-modules list.

3. **Add deps** via the project's package manager (`pnpm add -D` / `bun add -d`). Pin versions to match what the templates ship.

4. **Run formatter** (`pnpm biome check --write .` or equivalent) so the just-added scaffold files conform.

5. **Commit** with a single commit per logical chunk. Suggested: one commit per module applied. Use scoped messages: `chore(security): apply milky-kit security module`, `chore(ci): apply milky-kit CI module`, etc.

6. **Scan the codebase for patterns that need migrating to the new rules.** Examples:
   - If the project just adopted the Effect template's rules, scan for `throw new Error` in business logic, `T | null` in domain types, `Promise.all`, `console.log` in `src/`, inline `Effect.gen` in presentation handlers.
   - If the project just adopted the strict biome config, expect `noExplicitAny: error` + the `no-as-cast.grit` plugin to flag existing code. Run `pnpm -r lint` and surface findings.
   - For each pattern found, propose the rule-conforming version and ask whether to apply. Migrations that are mechanical (rename, single-file edit) get applied with consent. Migrations that require restructuring (extract a use case, refactor a layer) get a `// TODO: realign — <rule>` marker and the user fixes by hand.

7. **Invoke the `realign` skill** for the broader cross-check on the project as a whole.

8. **Report what was added vs skipped.** Be explicit about anything that would have overwritten existing config and what the user should review. Include realign's report.

## Refuse to do

- **Don't overwrite tests** or any `src/` content. The kit doesn't ship business code.
- **Don't run `glb init`** — hand off to the user (interactive prompt).
- **Don't aggressively replace `tsconfig.json`** — projects often have careful customizations there.
- **Don't strip user comments** from `package.json` / `biome.json` — preserve `//` keys.

## Conventions to honor

- **No PRs, no worktrees.** Work directly on `main`.
- **Frequent, small commits** with `(#N)` issue refs if the user has issues tracking this.
- **Run lint and typecheck** after merging to surface anything broken by the new rules (e.g. `noExplicitAny: error` from `@milkyskies/biome-config` flagging existing code).
