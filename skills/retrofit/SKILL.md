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

- `package.json` exists? → TS project. Which package manager? (`pnpm-lock.yaml`, `bun.lock`, `bun.lockb`, `package-lock.json`)
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

2. **Which paradigm/adapter rules apply**. Offer per detected stack:
   - **Effect-TS projects**: always offer `modules/effect/rules/effect.md` (paradigm + clean architecture). Additionally offer the adapter rules that match what the project does:
     - `modules/effect-http/rules/effect-http.md` if the project uses `@effect/platform` HttpApi (or plans to).
     - `modules/effect-mcp/rules/effect-mcp.md` if the project exposes MCP tools (or plans to).
     - `modules/effect-sql/rules/effect-sql.md` if the project uses `@effect/sql-drizzle` / `@effect/sql-pg` (or plans to).
     - A Matrix bot, CLI, or worker that uses Effect picks `effect` + whichever infrastructure modules apply. Project-specific presentation adapters (e.g. `presentation/matrix/`) are owned by the project, not the kit.
   - **Hono projects**: offer the `hono-api` template's rules.
   - **React / Axum / Bun-scripts**: offer those templates' rules.
   - Don't prescribe a paradigm if the project doesn't match cleanly — leave the rules empty and the project owns its CLAUDE.md.

3. **Project-specific rules (tsuika)** — free text. Appended under `## Project-specific` in CLAUDE.md after the kit refs.

## Steps to execute

1. **Reconcile `.claude/rules/` symlinks idempotently.** Re-running retrofit must converge: it adds new rules, removes ones from de-selected modules, and retargets ones whose source path moved in the kit. Sequence:

   1. **Compute the desired set.** Walk the user's chosen modules + the detected template (if any) + the always-on core rules. The desired set is a map of `<symlink-name>.md → <absolute-target-in-kit>` covering every rule that should exist after this run.

      Always-on rules (every project): `~/.claude/kit/modules/core/rules/{general,comments,config-and-env,workflow,worktrees,testing}.md`.

      Per chosen module: its `rules/*.md` files. Per detected template: its `rules/*.md` files (e.g. `effect-api` composes `effect`, `effect-http`, `effect-mcp`, `effect-sql`).

   2. **Read the current state** of `.claude/rules/`. For each entry, classify:
      - **kit-pointed symlink** — target resolves into `~/.claude/kit/` (or any path containing `milky-kit`). The retrofit owns these.
      - **other symlink** — points elsewhere (project-local rule, third-party). Leave alone.
      - **real file** — user-written. Leave alone; surface its existence.

   3. **Apply the diff:**
      - **Add** symlinks for entries in the desired set with no current symlink. `ln -s <target> .claude/rules/<name>.md`.
      - **Retarget** kit-pointed symlinks whose current target differs from the desired target (e.g. a rule moved in the kit, like today's effect split). `rm .claude/rules/<name>.md && ln -s <new-target> .claude/rules/<name>.md`.
      - **Remove** kit-pointed symlinks not in the desired set (module de-selected, rule deleted upstream). `rm .claude/rules/<name>.md`. **Never** rm a non-symlink or a non-kit-pointed symlink — ask first.
      - **Skip** symlinks that already point at the correct target. No-op.

   4. **Report** what was added / retargeted / removed before doing it. For removals, list each path so the user can object if it's not actually theirs to lose.

   ```bash
   # Example shape — the skill walks this for each desired rule
   mkdir -p .claude/rules

   # Add or retarget
   target=~/.claude/kit/modules/core/rules/general.md
   link=.claude/rules/general.md
   current=$(readlink "$link" 2>/dev/null || true)
   if [ "$current" != "$target" ]; then
     [ -L "$link" ] && rm "$link"
     ln -s "$target" "$link"
   fi
   ```

   For files that are real (non-symlink) at a path the desired set wants to claim, ask before replacing.

2. **Merge scaffold files** for each chosen module. Substitute all placeholders (`{{project_name}}`, `{{worktree_dir}}`, `{{app_name}}`, etc.) when copying:
   - For `package.json`: deep-merge — add new deps + scripts without touching existing keys. If a script name collides (e.g. `lint` already defined), ask which to keep.
   - For `biome.json`: replace with `{ "$schema": "...", "extends": ["@milkyskies/biome-config/biome.json"] }`, preserving any project-specific `files.includes` patterns from the old config.
   - For `tsconfig.json`: only update `extends` if the project doesn't already extend something the user cares about.
   - For `.github/workflows/*.yml`: skip if file exists; show diff and ask if they want to replace.
   - For `.github/dependabot.yml` (ships with the `security` module): if missing, copy and prune ecosystem blocks the project doesn't use (no `package.json` anywhere → strip `npm` block; no `Cargo.toml` anywhere → strip `cargo` block; `github-actions` always stays). If present, leave it alone — the user owns it.
   - For `_<name>` underscore-prefixed config files (e.g. `_biome.json`): strip the leading underscore at the destination. Same as the `new` skill — the underscore exists in scaffold form only, never in consumed projects.
   - For `.ghlobes.toml`: skip if present.
   - For `CLAUDE.md`: if missing, copy `~/.claude/kit/modules/core/scaffold/CLAUDE.md` (the minimal one) into the project. If present, leave it alone — rules now load from `.claude/rules/` symlinks, so any existing `@`-ref list in CLAUDE.md becomes redundant but harmless; suggest cleaning it up only if the user asks.
   - For `mise.toml`: if missing, generate it from the chosen modules following the same per-template `[tools]` + `[tasks.dev]` rules as the `new` skill. If present, ask before touching `[tools]`; offer to add missing `[tasks.check]`/`[tasks.fmt]`/`[tasks."db:setup"]` if absent.
   - For `.mise/tasks/worktree/{setup,cleanup,sync-env}`: render with placeholders substituted AND with the DB block conditional on whether `postgres` was applied. If `postgres` not in the applied set, strip `createdb`, the `DATABASE_URL` patch, and `mise run db:migrate` from worktree/setup; strip `dropdb` from cleanup. Same install-step logic as the `new` skill (pnpm/bun/none).

3. **Add `.milky-kit-version`** if missing. Same format as the `new` skill — kit SHA + timestamp + applied-modules list.

3a. **Add `.milky-kit-mode`** if missing. Default `branch` (single word, single line). The user can flip with `/milky-kit:mode main | branch | worktrees` later. If the file already exists, leave it alone — the user's prior choice stands.

4. **Add deps** via the project's package manager (`pnpm add -D` / `bun add -d`). Pin versions to match what the templates ship.

5. **Run formatter** (`pnpm biome check --write .` or equivalent) so the just-added scaffold files conform.

6. **Commit** with a single commit per logical chunk. Suggested: one commit per module applied. Use scoped messages: `chore(security): apply milky-kit security module`, `chore(ci): apply milky-kit CI module`, etc.

7. **Scan the codebase for patterns that need migrating to the new rules.** Examples:
   - If the project just adopted the Effect template's rules, scan for `throw new Error` in business logic, `T | null` in domain types, `Promise.all`, `console.log` in `src/`, inline `Effect.gen` in presentation handlers.
   - If the project just adopted the strict biome config, expect `noExplicitAny: error` + the `no-as-cast.grit` plugin to flag existing code. Run `pnpm -r lint` and surface findings.
   - For each pattern found, propose the rule-conforming version and ask whether to apply. Migrations that are mechanical (rename, single-file edit) get applied with consent. Migrations that require restructuring (extract a use case, refactor a layer) get a `// TODO: realign — <rule>` marker and the user fixes by hand.

8. **Invoke the `realign` skill** for the broader cross-check on the project as a whole.

9. **Report what was added vs skipped + the manual setup steps the user must complete**, with direct links. Substitute `{{owner}}`, `{{repo}}`, `{{package}}` from the project's actual values. Never leave the user guessing where to go.

   **If `~/.claude/kit` doesn't exist on this machine yet:**
   ```
   ln -s ~/Code/Projects/milky-kit ~/.claude/kit
   ```

   **If `release-please` module applied** (need GitHub Actions to be able to open PRs):
   - <https://github.com/{{owner}}/{{repo}}/settings/actions> → scroll to **Workflow permissions** → check **Allow GitHub Actions to create and approve pull requests** → Save.

   **If `release-please` with npm-publish variant applied** (need Trusted Publishing OIDC):
   - <https://www.npmjs.com/package/{{package}}/access> → scroll to **Trusted Publisher** → **Add** → **GitHub Actions** → fill: Organization=`{{owner}}`, Repository=`{{repo}}`, Workflow filename=`release-please.yml` (the CALLER workflow), Environment name=blank → Save.
   - If `@scope` doesn't exist yet on npm: <https://www.npmjs.com/org/create>.

   **If `ghlobes` module applied and project doesn't yet have a GitHub Project:**
   - Personal account: <https://github.com/users/{{owner}}/projects/new>. Org: <https://github.com/orgs/{{owner}}/projects/new>. Pick "New project" → "Board" or "Table". Note the project number.
   - Then run `glb init` in the project dir (interactive — answers the project number prompt; creates the Status/Priority/Points fields if missing).

   **If `postgres` module applied:**
   - Start Docker Desktop (no link — open the app). Verify with `docker info`.
   - Run the first migration: `pnpm db:migrate` from the api dir (or wherever drizzle.config.ts lives).

   Include realign's report at the end. List anything that would have overwritten existing config and what the user should review.

## Refuse to do

- **Don't overwrite tests** or any `src/` content. The kit doesn't ship business code.
- **Don't run `glb init`** — hand off to the user (interactive prompt).
- **Don't aggressively replace `tsconfig.json`** — projects often have careful customizations there.
- **Don't strip user comments** from `package.json` / `biome.json` — preserve `//` keys.

## Conventions to honor

- **No PRs, no worktrees.** Work directly on `main`.
- **Frequent, small commits** with `(#N)` issue refs if the user has issues tracking this.
- **Run lint and typecheck** after merging to surface anything broken by the new rules (e.g. `noExplicitAny: error` from `@milkyskies/biome-config` flagging existing code).
