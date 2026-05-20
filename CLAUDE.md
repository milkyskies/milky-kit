# milky-kit

This repository is milky-kit itself. It holds:

- `templates/` — paradigm-complete stack templates (alternatives, pick one per consuming project)
- `modules/` — cross-cutting modules that compose with any template
- `skills/` — Claude Code plugin skills (`new`, `retrofit`, `upgrade`, `realign`, `edit`, `kit-modify`, `check-version`)
- `.claude-plugin/plugin.json` — the plugin manifest itself

Rules are loaded automatically by Claude Code from `.claude/rules/`. Those files are relative symlinks into `modules/*/rules/` — the kit dogfoods its own modules, single source of truth, no copying.

## Project-specific

- **Work directly on `main`.** This repo doesn't use PRs or worktrees for kit work; commit small, frequent changes with `(#N)` issue refs so the GitHub Project stays in sync.
- **Never edit a template's scaffold files inside a consuming project.** Edit them here, then the project's next `/milky-kit:upgrade` picks them up.
- **Don't `git push --force` or rewrite history.** This kit is referenced from consuming projects via the `~/.claude/kit/` symlink and direct paths; rewrites break those.
- **When stripping Effect content from a paradigm-neutral file**, the destination is `templates/effect-api/rules/effect.md`. The Hono template stays Effect-flavored intentionally — that's the "Effect-flavored Hono" track.
- **Issue tracker is `glb`** (see ghlobes rules). Always `glb next` at session start, `glb update <n> --claim` before editing, `glb done <n>` when finishing.
