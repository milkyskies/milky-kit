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

6. **Write `CLAUDE.md`.** Copy `~/.claude/kit/templates/<template>/CLAUDE.md` into the project. It has the project description and `## Project-specific` section. Don't add `@`-refs to it — rules load from `.claude/rules/` (next step) automatically. Append the user's tsuika text from step 5 under `## Project-specific`.

7. **Create `.claude/rules/` and symlink the chosen rules in.** Claude Code auto-loads every `.md` (and `.md` symlink) under `.claude/rules/`. For each rule the template + chosen modules need:

   ```bash
   mkdir -p .claude/rules
   ln -s ~/.claude/kit/templates/<template>/rules/<rule>.md .claude/rules/<rule>.md
   ln -s ~/.claude/kit/modules/<module>/rules/<rule>.md .claude/rules/<rule>.md
   ```

   Always-on rules (every template gets these):
   - `~/.claude/kit/modules/core/rules/{general,comments,config-and-env,workflow,worktrees,testing}.md`

   Template-specific rules (read the template's `rules/` directory).

   Composable-module rules (per the user's selections in step 2): `ghlobes/rules/glb.md`, `ci/rules/ci.md`, `security/rules/security.md`, `release-please/rules/release-please.md`, `pnpm/rules/pnpm-security.md`, `bun/rules/bun.md`, `postgres/rules/postgres.md`, etc.

   The symlinks point through `~/.claude/kit/` (absolute), so they survive the user moving project directories but require `~/.claude/kit/` to be set up on each machine (see kit README — `ln -s ~/Code/Projects/milky-kit ~/.claude/kit`).

8. **Write `.milky-kit-version`** at the project root. Contents:

   ```
   <kit SHA from `git -C ~/.claude/kit rev-parse HEAD`>
   <iso-8601 timestamp of scaffold>
   <template>
   modules: <comma-separated list>
   ```

9. **Initialize git.** `git init -b main`. Add a `.gitignore` if not already present (most scaffolds ship one). Make the initial commit:

   ```
   chore: initial scaffold from milky-kit <short SHA>

   Template: <template>
   Modules: <list>
   Variants: <list>
   ```

10. **Install dependencies.** If `pnpm` module chosen: `pnpm install`. If `bun`: `bun install`. If Cargo (Rust template): `cargo fetch`. Report install output.

11. **Run formatter.** Format the freshly-scaffolded code to the project's biome / cargo fmt to clean up any `{{app_name}}` substitution artifacts.

12. **Print "Manual steps you need to do" with direct links.** Every step that requires the user (web UI clicks, interactive prompts, credentials) gets its own line with **either a clickable URL or explicit click-path instructions**. Never leave the user guessing where to go. Substitute `{{owner}}`, `{{repo}}`, `{{package}}` from the project's actual values.

    Always include:

    **One-time per machine, if not already done:**
    - Symlink the kit at `~/.claude/kit`:
      ```
      ln -s ~/Code/Projects/milky-kit ~/.claude/kit
      ```
      (No link — terminal command.)

    **One-time per GitHub repo:**
    - Create the repo on GitHub. Direct link: <https://github.com/new> — or run `gh repo create <project-name> --private --source . --push` from the project directory.
    - Enable PR creation by Actions (needed for release-please): direct link <https://github.com/{{owner}}/{{repo}}/settings/actions> → scroll to **Workflow permissions** → check **Allow GitHub Actions to create and approve pull requests** → Save.

    **If ghlobes module chosen:**
    - Create the GitHub Project (Beta). Direct link for personal account: <https://github.com/users/{{owner}}/projects/new>. For an org: <https://github.com/orgs/{{owner}}/projects/new>. Pick "New project" → "Board" or "Table". Note the project number (e.g. `17`).
    - Run `glb init` in the project dir. Interactive — it'll prompt for the project number you just noted. It'll create the Status/Priority/Points fields if missing.

    **If the project will publish to npm (e.g. `@scope/pkg`):**
    - Make sure the npm scope exists. If `@scope` is not yet registered: <https://www.npmjs.com/org/create> (free plan is fine for public packages).
    - Configure Trusted Publishing (OIDC, no token needed). Direct link: <https://www.npmjs.com/package/{{package}}/access> → scroll to **Trusted Publisher** → **Add** → **GitHub Actions** → fill: Organization=`{{owner}}`, Repository=`{{repo}}`, Workflow filename=`release-please.yml` (the CALLER workflow; npm authorizes the entry point), Environment name=blank → Save.

    **If the project uses Postgres (postgres module chosen):**
    - Start Docker Desktop (no link — open the app). The scaffold's docker-compose.yml expects it. Verify with `docker info` → no error means it's running.
    - First migration: `pnpm db:migrate` from the api dir.

    **Project lives at:** `./<project-name>`. Open with your editor.

## Conventions to honor

- **No PRs, no worktrees.** Work directly on `main`.
- **Substitute `{{app_name}}` everywhere** — in path names and file contents.
- **Don't overwrite files the user created** if the project directory already had content. If the directory isn't empty, ask before continuing; offer `retrofit` instead.
- **Run `glb init` instructions** rather than running it directly — `glb init` is interactive (asks the user to pick a GitHub Project), so hand it off per the general "hand off interactive steps" rule.
- **One commit** for the initial scaffold. Don't split into ten small commits.
