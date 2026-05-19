---
name: new
description: Scaffold a new project from a milky-kit template. Use when the user wants to start a new project with milky-kit conventions — Effect API, Hono API, Rust/Axum API, React SPA, or Bun scripts. Asks for template, composable modules, variants, project name, and optional project-specific rules.
---

# Scaffold a new milky-kit project

Use this skill to bootstrap a new project from one of the templates in `~/.claude/kit/templates/` (the milky-kit checkout, symlinked at `~/.claude/kit`). The project ends up with a working scaffold, a CLAUDE.md wired with `@`-refs into the kit, and a `.milky-kit-version` recording the kit SHA it was generated from.

## When to invoke

User says any of: "scaffold a new project", "set up an Effect API", "new milky-kit project", "create a Hono backend", "/milky-kit:new". If unsure, ask: "are you starting from scratch (use `new`) or applying the kit to an existing repo (use `retrofit`)?"

## Inputs to gather (use AskUserQuestion, not free-form chat)

1. **Template** — which paradigm? Options pulled from `~/.claude/kit/templates/`:
   - `effect-api` — TS + Effect + @effect/platform + Postgres + Drizzle + MCP
   - `hono-api` — TS + Hono + Drizzle + Effect-flavored
   - `react-spa` — TS + React + TanStack + Vite
   - `axum-api` — Rust + Axum + SeaORM + Postgres
   - `bun-scripts` — Bun + TS scripts

2. **Composable modules** (multi-select): `ghlobes`, `security`, `ci`, `postgres`, `sqlite`, `pnpm` or `bun`. Default selections per template:
   - `effect-api` / `hono-api`: `ghlobes`, `security`, `ci`, `pnpm`, `postgres`
   - `react-spa`: `ghlobes`, `security`, `ci`, `pnpm`
   - `axum-api`: `ghlobes`, `security`, `ci`, `postgres`
   - `bun-scripts`: `ghlobes`, `bun`

3. **Variants** (only when the chosen template has them). Read `~/.claude/kit/templates/<template>/variants/` to discover axes. Examples:
   - `hono-api`: `db` (d1/neon/supabase), `api_style` (rpc/openapi), `auth` (firebase/none)
   - `react-spa`: `mobile` (none/tauri/capacitor), `ui` (none/shadcn/heroui/base-ui), `auth` (firebase/none)

4. **Project name** — kebab-case, used for directory + workspace name + `{{app_name}}` substitution.

5. **Project-specific rules (tsuika)** — free text, optional. Appended under `## Project-specific` in CLAUDE.md. The kit's `@`-refs stay above; this section is owned by the project forever.

## Steps to execute

1. **Confirm target directory.** Default: `./<project-name>` from current working directory. Ask if a different parent is preferred.

2. **Create the directory and `cd` into it.**

3. **Copy the template's scaffold tree.** Walk `~/.claude/kit/templates/<template>/scaffold/` recursively, copying every file. Substitute `{{app_name}}` in both paths and file contents with the project name (or `api` / `web` / `client` etc. when the template ships with such defaults — read the template's README to learn the convention).

4. **Apply variant overlays.** For each chosen variant, copy `~/.claude/kit/templates/<template>/variants/<axis>/<choice>/` over the base scaffold (overlay, not merge). JSON files (`package.json`, `tsconfig.json`) merge by key when both exist; everything else overwrites the base.

5. **Apply composable module scaffolds.** For each chosen module in `~/.claude/kit/modules/<name>/scaffold/`, copy files into the project root (or wherever the module's `module.toml` says). Same merge rules: JSON merge, others overwrite.

6. **Write `CLAUDE.md`.** Use `~/.claude/kit/templates/<template>/CLAUDE.md` as the base template (if it exists), or compose from rule refs. Final shape:

   ```md
   # <project name>

   <one-line description placeholder>

   ## Template
   @~/.claude/kit/templates/<template>/rules/<rule>.md

   ## Shared
   @~/.claude/kit/modules/core/rules/general.md
   @~/.claude/kit/modules/core/rules/comments.md
   @~/.claude/kit/modules/core/rules/config-and-env.md
   @~/.claude/kit/modules/ts/rules/blank-lines.md   # if TS

   ## Composables
   @~/.claude/kit/modules/<each-chosen-module>/rules/*.md

   ## Project-specific

   <whatever the user provided in step 5 of inputs>
   ```

7. **Write `.milky-kit-version`** at the project root. Contents:

   ```
   <kit SHA from `git -C ~/.claude/kit rev-parse HEAD`>
   <iso-8601 timestamp of scaffold>
   <template>
   modules: <comma-separated list>
   ```

8. **Initialize git.** `git init -b main`. Add a `.gitignore` if not already present (most scaffolds ship one). Make the initial commit:

   ```
   chore: initial scaffold from milky-kit <short SHA>

   Template: <template>
   Modules: <list>
   Variants: <list>
   ```

9. **Install dependencies.** If `pnpm` module chosen: `pnpm install`. If `bun`: `bun install`. If Cargo (Rust template): `cargo fetch`. Report install output.

10. **Run formatter.** Format the freshly-scaffolded code to the project's biome / cargo fmt to clean up any `{{app_name}}` substitution artifacts.

11. **Print next steps.** Always tell the user:
    - The project lives at `./<project>`.
    - If `ghlobes` chosen: "Run `glb init` to wire up the GitHub Project for issue tracking."
    - Template-specific bootstrap: docker-compose up for postgres, `pnpm db:migrate` for first migration, etc. Read the template's README for the exact steps.

## Conventions to honor

- **No PRs, no worktrees.** Work directly on `main`.
- **Substitute `{{app_name}}` everywhere** — in path names and file contents.
- **Don't overwrite files the user created** if the project directory already had content. If the directory isn't empty, ask before continuing; offer `retrofit` instead.
- **Run `glb init` instructions** rather than running it directly — `glb init` is interactive (asks the user to pick a GitHub Project), so hand it off per the general "hand off interactive steps" rule.
- **One commit** for the initial scaffold. Don't split into ten small commits.
