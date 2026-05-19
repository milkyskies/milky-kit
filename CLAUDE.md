# milky-kit

This repository is milky-kit itself. It holds:

- `templates/` — paradigm-complete stack templates (alternatives, pick one per consuming project)
- `modules/` — cross-cutting modules that compose with any template
- `skills/` — Claude Code plugin skills (`new`, `retrofit`, `upgrade`, `check-version`)
- `.claude-plugin/plugin.json` — the plugin manifest itself

## Rules loaded here

The user's global `~/.claude/CLAUDE.md` already references the universal rules in `modules/core/` and `modules/ts/`. This file only adds what's specific to working on the kit itself.

@./modules/ghlobes/rules/glb.md
@./modules/ci/rules/ci.md
@./modules/security/rules/security.md

## Project-specific

- **Work directly on `main`.** This repo doesn't use PRs or worktrees for kit work; commit small, frequent changes with `(#N)` issue refs so the GitHub Project stays in sync.
- **Never edit a template's scaffold files inside a consuming project.** Edit them here, then the project's next `/milky-kit:upgrade` picks them up.
- **Don't reach for `git push --force` or rewrite history.** This kit may be referenced from other machines via the `@`-ref symlink; rewrites break those projects.
- **When stripping Effect content from a paradigm-neutral file**, the destination is `templates/effect-api/rules/effect.md`. When stripping Effect content from a Hono-flavored template, leave it — Hono is the "Effect-flavored Hono" track on purpose.
- **Issue tracker is `glb`** (see ghlobes rules). Always `glb next` at session start, `glb update <n> --claim` before editing, `glb done <n>` when finishing.
