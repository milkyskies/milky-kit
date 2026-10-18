# milky-kit

Personal project kit for full-stack work. Ships paradigm-complete stack templates, composable modules for cross-cutting concerns (CI, security, issues), and a Claude Code plugin that scaffolds new projects and retrofits existing ones.

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
| `modules/effect` | Effect-TS paradigm + universal clean architecture (domain/application/infrastructure/presentation). Use for any Effect project regardless of inbound protocol. |
| `modules/effect-http` | `@effect/platform` HttpApi + Swagger + typed client + outbound HttpClient. Composes with `effect`. |
| `modules/effect-mcp` | `@effect/ai` McpServer adapter. Composes with `effect`. |
| `modules/effect-sql` | `@effect/sql-drizzle` + `@effect/sql-pg` repository pattern. Composes with `effect` + a DB module. |
| `modules/ci` | GitHub Actions workflow + per-package script enforcement |
| `modules/security` | OSV-Scanner, zizmor, pinned actions, GitHub-context shell-injection prevention |
| `modules/pnpm` | pnpm workspace config + pnpm-specific supply-chain controls (cooldown, safe-chain, trust policy, onlyBuiltDependencies) |
| `modules/bun` | Bun workspace + Bun-specific security notes (with honest gaps) |
| `modules/frontdesk` | The frontdesk worker contract (`frontdesk.md`), the `## frontdesk` section template, and the `frontdesk` state program workers use to claim, park, finish and fail an issue |
| `modules/issues` | Label set, `setup-labels.sh`, and the issue-tracking agent rule file (plain `gh`, stage labels) |
| `modules/postgres` | docker-compose Postgres + Effect-flavored `@effect/sql-pg` notes |
| `modules/sqlite` | local SQLite scaffold |
| `modules/release-please` | GitHub Actions release pipeline + Trusted Publishing OIDC (variants: npm publish / tag-only) |

A project's `.claude/rules/` directory symlinks one rule per file into the chosen template + modules. Claude Code auto-loads every `.md` (including symlinks) under `.claude/rules/` at session start.

## Rule symlinks are per machine

`.claude/rules/*.md` are symlinks into `~/.claude/kit`, whose real path differs per machine and OS. They are **gitignored**; the committed record is `.claude/rules.manifest`.

After cloning a project on a new machine — or after your first `retrofit`:

```bash
mise run rules:link
```

Without it the rules simply do not load, and nothing says so. If an agent seems to be ignoring the project's conventions, check this first:

```bash
for f in .claude/rules/*.md; do [ -e "$f" ] || echo "BROKEN $f"; done
```

Rules a project owns itself are regular files, not symlinks, and stay tracked as normal.

## How a project consumes the kit

Rules are **symlinked**, not copied. Each project's `.claude/rules/` directory holds one symlink per rule, pointing through `~/.claude/kit/` to the live source-of-truth file in this repo:

```
my-project/.claude/rules/
├── general.md           -> ~/.claude/kit/modules/core/rules/general.md
├── comments.md          -> ~/.claude/kit/modules/core/rules/comments.md
├── effect.md            -> ~/.claude/kit/modules/effect/rules/effect.md
├── effect-http.md       -> ~/.claude/kit/modules/effect-http/rules/effect-http.md
├── effect-sql.md        -> ~/.claude/kit/modules/effect-sql/rules/effect-sql.md
├── postgres.md          -> ~/.claude/kit/modules/postgres/rules/postgres.md
└── ...
```

Claude Code auto-loads every `.md` (including symlinks) under `.claude/rules/` at session start — no `@`-refs needed in CLAUDE.md. The symlinks live in git (mode 120000); they reconstruct on checkout as long as the target exists on that machine.

Edit a rule file in milky-kit, and every project picks it up immediately — the symlinks point to the live file. Single source of truth, no copy, no drift.

Scaffold files (gitignore, biome.json, tsconfig, CI workflows, setup-labels.sh) are **copied once at init**, then the project owns them. Updates flow through the upgrade skill.

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

Claude clones the repo to its own plugin cache and registers the skills. Run `/help` to confirm `/milky-kit:new`, `:retrofit`, `:upgrade`, `:realign`, `:edit`, `:kit-modify`, `:check-version`, `:purge`, `:mode`, `:decisions`, `:frontdesk`, `:here`, plus the pre-existing `:ship`, `:land`, `:rulify`, `:simplify`, etc. all appear.

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
2. Which composable modules? (multi-select: issues, security, ci, postgres, etc.)
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

## Workflow modes

Each project picks one workflow mode via the `.milky-kit-mode` file at its root:

| Mode | Branch | Worktree | Ship via | Best for |
|---|---|---|---|---|
| `main` | no — on `main` | no | push to `main` | the kit itself, solo solo work, no review wanted |
| `branch` (default) | yes — in root checkout | no | PR to `main` | typical solo work, GitHub-native flow |
| `worktrees` | yes — in the worktree | yes — **every task by default**, in `../<worktree-dir>/<num>/`; root only via `/milky-kit:here` | PR to `main` | parallel multi-agent work, the frontdesk, keeping the root free |

Flip per project at any time:

```
/milky-kit:mode main         # switch to main
/milky-kit:mode branch       # switch to branch
/milky-kit:mode worktrees    # switch to worktrees
/milky-kit:mode              # show current
```

`workflow.md` reads `.milky-kit-mode` at session start and follows the matching task workflow section.

In `worktrees` mode a worktree is the **default** for every task. To work in the root checkout instead — a typo fix, a one-line config change, anything not worth paying worktree setup for — use `/milky-kit:here`.

## The frontdesk

The frontdesk is how autonomous workers take eligible issues from `stage:ready` to a pull request. GitHub Issues hold all state. A coordinator, started with `/milky-kit:frontdesk`, compares open issues with Orca's running workers each pass and fixes the difference. Workers record every outcome on their issue with the `frontdesk` program (`frontdesk claim`, `frontdesk park`, `frontdesk done`, `frontdesk fail`) before they report back.

The worker contract and the decision comment format are in `modules/frontdesk/rules/frontdesk.md`. The coordinator loop and its reference files are in `skills/frontdesk/`. The design is in `docs/frontdesk/phase-2.md`. A project configures the frontdesk in a `## frontdesk` section of its `CLAUDE.md`, copied from `modules/frontdesk/frontdesk-section.md`.

### Opting an issue in

Describe the work and let the agent write the issue:

```
/milky-kit:todo add a reload-cancel when the player sprints
```

The skill drafts the house body format, asks only what it cannot infer from the code, shows you the result, and files it with the `autopilot` label. Or add the label by hand:

```bash
gh issue edit <num> --add-label autopilot
```

Nothing runs on an issue you have not explicitly opted in. There is no `no-autopilot` label, because forgetting a label must mean an agent leaves the issue alone rather than running unattended on work nobody vetted.

### Answering what an agent gets stuck on

When an agent hits something it must not guess at, it posts the question as an issue comment and moves the issue to `stage:needs-you`.

```
/milky-kit:decisions
```

presents each parked question with the options the agent proposed, and records whatever you answer with `frontdesk answer`, which moves the issue back to `stage:ready`. You can also reply on the GitHub issue, including from the mobile app, and then move the issue back to `stage:ready` yourself.

## Versioning

milky-kit has no semver tags (yet). The version of milky-kit a project was scaffolded against is the **commit SHA** at scaffold time, recorded in the project's `.milky-kit-version` file. `milky-kit:check-version` compares that SHA against `git rev-parse HEAD` of the local kit checkout and prints what's changed since.

Tagged releases may come later as the kit stabilizes; the skills will prefer tag names over SHAs once they exist.

## Repo layout

```
milky-kit/
├── README.md
├── .claude-plugin/             Claude Code plugin manifest
├── skills/                     Plugin skills (new, retrofit, upgrade, realign, edit, kit-modify, check-version, purge, mode, frontdesk, decisions, ship, land, write-pr, arch-diagrams, rulify, simplify, retrospective, and template-specific helpers)
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
    ├── issues/
    ├── postgres/
    ├── sqlite/
    └── release-please/
```

## Why templates vs modules

The split exists because not every concern composes. Templates declare paradigm choices that conflict with each other (Effect's typed error channel vs Hono's middleware throws; Rust's Result vs TS's Promise). You pick one. Modules declare orthogonal concerns (CI is independent of the API framework; issue tracking is independent of the language). They layer freely.

This split is what makes the asymmetry between templates honest. `effect-api` ships MCP, `hono-api` does not — that's not a missing feature, it's a different paradigm with a different ceiling. Each template's `README.md` lists its capabilities so projects choose with eyes open.

## Task tracking

This kit tracks work with GitHub Issues and labels through plain `gh`. See `modules/issues/rules/issues.md` for the labels, stages and command reference.
