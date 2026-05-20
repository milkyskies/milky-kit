# milky-kit

Personal project kit for full-stack work. Ships paradigm-complete stack templates, composable modules for cross-cutting concerns (CI, security, ghlobes), and a Claude Code plugin that scaffolds new projects and retrofits existing ones.

## The two layers

Two kinds of things live in this repo, and they compose differently. Mixing them up is the trap most kit repos fall into.

### Templates (alternatives) — pick one per project

A **template** is a complete paradigm choice for a project. Each template owns its rules, scaffold tree, CLAUDE.md template, and capability set. Templates don't compose with each other.

| Template | Stack | Headline capabilities |
|---|---|---|
| `templates/effect-api` | TS + Effect + `@effect/platform` + `@effect/sql-drizzle` + Postgres | HttpApi-driven server, auto-generated OpenAPI + Swagger, typed `HttpApiClient`, MCP server (`@effect/ai`), typed error channel, Schema-everywhere boundaries, Layer/Context DI, `@effect/vitest` |
| `templates/hono-api` | TS + Hono + Drizzle + Effect (flavored) | Hono RPC, Zod-OpenAPI (manual), middleware DI, Workers deploy |
| `templates/react-spa` | TS + React + TanStack Router/Query + Vite | Suspense-first data fetching, file-based routing, UI variants |
| `templates/axum-api` | Rust + Axum + SeaORM + Postgres | Clean-architecture domain split, typed Result errors, OpenAPI via utoipa |
| `templates/bun-scripts` | Bun + TS | Single-file scripts, no build step, Bun-native APIs |

### Modules (composables) — layer on top of any template

A **module** is one orthogonal concern that composes cleanly with any template. They don't conflict because each module addresses a different concern.

| Module | What it adds |
|---|---|
| `modules/core` | General rules, comments, config/env conventions, worktree mise tasks |
| `modules/ts` | Paradigm-neutral TypeScript conventions, blank-lines style |
| `modules/ci` | GitHub Actions workflow + per-package script enforcement |
| `modules/security` | OSV-Scanner, zizmor, pinned actions, GitHub-context shell-injection prevention |
| `modules/pnpm` | pnpm workspace config + pnpm-specific supply-chain controls (cooldown, safe-chain, trust policy, onlyBuiltDependencies) |
| `modules/bun` | Bun workspace + Bun-specific security notes (with honest gaps) |
| `modules/ghlobes` | `.ghlobes.toml` scaffold + the glb agent rule file |
| `modules/postgres` | docker-compose Postgres + Effect-flavored `@effect/sql-pg` notes |
| `modules/sqlite` | local SQLite scaffold |
| `modules/release-please` | GitHub Actions release pipeline + Trusted Publishing OIDC (variants: npm publish / tag-only) |

A project's `.claude/rules/` directory symlinks one rule per file into the chosen template + modules. Claude Code auto-loads every `.md` (including symlinks) under `.claude/rules/` at session start.

## How a project consumes the kit

Rules are **symlinked**, not copied. Each project's `.claude/rules/` directory holds one symlink per rule, pointing through `~/.claude/kit/` to the live source-of-truth file in this repo:

```
my-project/.claude/rules/
├── general.md           -> ~/.claude/kit/modules/core/rules/general.md
├── comments.md          -> ~/.claude/kit/modules/core/rules/comments.md
├── effect.md            -> ~/.claude/kit/templates/effect-api/rules/effect.md
├── postgres.md          -> ~/.claude/kit/modules/postgres/rules/postgres.md
└── ...
```

Claude Code auto-loads every `.md` (including symlinks) under `.claude/rules/` at session start — no `@`-refs needed in CLAUDE.md. The symlinks live in git (mode 120000); they reconstruct on checkout as long as the target exists on that machine.

Edit a rule file in milky-kit, and every project picks it up immediately — the symlinks point to the live file. Single source of truth, no copy, no drift.

Scaffold files (gitignore, biome.json, tsconfig, CI workflows, .ghlobes.toml) are **copied once at init**, then the project owns them. Updates flow through the upgrade skill.

## Setup

One-time, per machine. Two parts: a symlink for rule resolution, and a plugin install for the skills.

### 1. Symlink the kit at `~/.claude/kit`

Clone milky-kit anywhere stable on your machine (not Downloads or anywhere your OS may clean), then symlink:

```bash
git clone https://github.com/milkyskies/milky-kit <wherever-you-keep-projects>/milky-kit
ln -s <wherever-you-keep-projects>/milky-kit ~/.claude/kit
ls -la ~/.claude/kit  # verify it resolves
```

The kit can live at any path as long as `~/.claude/kit` points to it. The symlink is what consuming projects' `.claude/rules/` symlinks resolve through. The kit's own `.claude/rules/` uses *relative* symlinks back into its `modules/`, so cloning on a new machine works without any setup — it eats its own dog food.

### 2. Install the Claude Code plugin

In any Claude Code session (project doesn't matter for the install):

```
/plugin marketplace add milkyskies/milky-kit
/plugin install milky-kit@milkyskies
```

Claude clones the repo to its own plugin cache and registers the skills. Run `/help` to confirm `/milky-kit:new`, `:retrofit`, `:upgrade`, `:realign`, `:edit`, `:kit-modify`, `:check-version`, plus the pre-existing `:ship`, `:land`, `:rulify`, `:simplify`, etc. all appear.

To pull future kit changes:

```
/plugin marketplace update milkyskies
```

## Scaffold a new project

In Claude Code, in an empty directory:

```
/milky-kit:new
```

The skill asks:
1. Which template? (`effect-api`, `hono-api`, `react-spa`, `axum-api`, `bun-scripts`)
2. Which composable modules? (multi-select: ghlobes, security, ci, postgres, etc.)
3. Variants where applicable (db backend, auth, UI library)
4. Project name + directory
5. Any project-specific rules to append? (free-text, written under `## Project-specific` in CLAUDE.md)

Then it copies the template + module scaffolds, creates `.claude/rules/` symlinks for every chosen rule, writes a thin `CLAUDE.md` (project description + project-specific section), runs the package manager install, initializes git, and commits the initial scaffold.

## Apply the kit to an existing repo

```
/milky-kit:retrofit
```

The skill detects the current stack, asks which modules to apply, copies in scaffold files (merging, not overwriting), creates `.claude/rules/` symlinks for the new rules, and writes a thin `CLAUDE.md` if none exists. Existing project-specific content stays untouched.

## Upgrade an existing project

```
/milky-kit:upgrade
```

The skill reads `.milky-kit-version`, walks milky-kit's git log since that SHA, and guides you through each change that affects your project's stack — with judgment, because every project diverges from the kit over time.

## Versioning

milky-kit has no semver tags (yet). The version of milky-kit a project was scaffolded against is the **commit SHA** at scaffold time, recorded in the project's `.milky-kit-version` file. `milky-kit:check-version` compares that SHA against `git rev-parse HEAD` of the local kit checkout and prints what's changed since.

Tagged releases may come later as the kit stabilizes; the skills will prefer tag names over SHAs once they exist.

## Repo layout

```
milky-kit/
├── README.md
├── .claude-plugin/             Claude Code plugin manifest
├── skills/                     Plugin skills (new, retrofit, upgrade, realign, edit, kit-modify, check-version, ship, land, rulify, simplify, retrospective, and template-specific helpers)
├── templates/                  Stack templates (alternatives — pick one per project)
│   ├── effect-api/
│   │   ├── rules/
│   │   ├── scaffold/           One-shot copy at init
│   │   └── CLAUDE.md           Template for the project's CLAUDE.md
│   ├── hono-api/
│   ├── react-spa/
│   ├── axum-api/
│   └── bun-scripts/
└── modules/                    Cross-cutting modules (composables — layer freely)
    ├── core/
    ├── ts/                     Paradigm-neutral TS rules
    ├── ci/
    ├── security/
    ├── pnpm/
    ├── bun/
    ├── ghlobes/
    ├── postgres/
    ├── sqlite/
    └── release-please/
```

## Why templates vs modules

The split exists because not every concern composes. Templates declare paradigm choices that conflict with each other (Effect's typed error channel vs Hono's middleware throws; Rust's Result vs TS's Promise). You pick one. Modules declare orthogonal concerns (CI is independent of the API framework; ghlobes is independent of the language). They layer freely.

This split is what makes the asymmetry between templates honest. `effect-api` ships MCP, `hono-api` does not — that's not a missing feature, it's a different paradigm with a different ceiling. Each template's `README.md` lists its capabilities so projects choose with eyes open.

## Task tracking

This kit uses `glb` (ghlobes) for issue tracking via GitHub Issues + Projects. See `modules/ghlobes/rules/glb.md` for the agent workflow and command reference.
