---
name: upgrade
description: Upgrade a project that was scaffolded from milky-kit. Reads the project's .milky-kit-version, diffs the kit's git log since that SHA, and walks the user through each change that affects this project's stack — with judgment, because every project diverges from the kit over time.
---

# Upgrade an existing milky-kit project

Use this skill to bring a project up to date with the latest milky-kit. It's deliberately manual: the kit can move in ways that don't apply cleanly to every project (the user may have customized biome.json, the scaffold's `package.json` may have diverged, a module may have been renamed). The skill walks each change as a discrete decision rather than blindly running a merge.

## When to invoke

User says any of: "upgrade milky-kit", "check for milky-kit updates", "/milky-kit:upgrade", "what changed in the kit?". Or after `milky-kit:check-version` reports the project is behind.

## Detect first

1. Read `./.milky-kit-version` at the project root. Extract the **base SHA**, the **template**, and the list of **applied modules**.
2. If the file doesn't exist, suggest running `/milky-kit:retrofit` instead — the project wasn't scaffolded from the kit (or pre-dates the version-tracking convention).
3. Read `git -C ~/.claude/kit rev-parse HEAD` for the **current kit SHA**.
4. If `base == current`, report "you're already up to date" and exit.

## Build the upgrade plan

Run `git -C ~/.claude/kit log --oneline <base>..HEAD -- <paths>` filtered to the paths the project cares about:

- `templates/<applied-template>/**`
- For each applied module: `modules/<module>/**`
- Always: `modules/core/**`, `modules/ts/**` (TS projects)
- The kit's `README.md` and root `CLAUDE.md` (for kit-wide convention changes)

Group the commits into themes. For each, decide whether it's:

- **Mechanical** — a rule file changed, a scaffold file got a small tweak. Show diff; user accepts or skips.
- **Structural** — a module was renamed, a paradigm rule was added that will fail lint. Walk through implications: "module X is now Y; we'd need to update the `@`-ref. Continue?"
- **Optional** — a new module was added. Ask if the user wants to apply it (same flow as `retrofit` for that module).
- **Breaking** — paths moved, a dep was upgraded with breaking changes. Explain what will break and ask before touching anything.

## Steps to execute per change

For each change the user accepts:

1. **Apply the diff** to the project. For scaffold files, copy the new version from `~/.claude/kit/...` over the project's copy — but only after showing the diff. For rule `@`-refs (path changes), edit `CLAUDE.md` to point at the new path.
2. **Run lint + typecheck** after each substantive change. New rules will surface new violations — let the user decide which to fix now vs file as TODOs.
3. **Commit** with a clear scope: `chore: upgrade milky-kit <description>` referencing the kit commit SHA in the body.

After all changes are applied (or skipped):

1. **Scan the project's CLAUDE.md for drift.** Now that the kit has moved, some `@`-refs may point to files that were renamed or deleted. Detect by reading each `@`-ref path and checking it resolves to a real file. Propose fixes (rename `@-ref` to new path, or remove if the rule was deleted). Walk one at a time.
2. **Invoke the `realign` skill.** Pass it the list of rules that changed in this upgrade so realign focuses on those rather than scanning everything. The user accepts/skips each violation realign finds.
3. **Update `.milky-kit-version`** to the new kit SHA + new timestamp. Preserve the template + modules list.
4. **Final summary** — applied N, skipped M, what's still TODO, plus manual setup steps the user must complete (with direct links). Substitute `{{owner}}`, `{{repo}}`, `{{package}}`.

   Always check and surface (skip the ones that don't apply):

   - **Symlink stale?** If `~/.claude/kit` is missing or points to the wrong place, the `.claude/rules/` symlinks won't resolve. Quick check: `ls -la ~/.claude/kit`. Fix: `ln -s <kit-checkout-path> ~/.claude/kit`.
   - **Workflow permissions** (if release-please module is active and the project hasn't enabled this): <https://github.com/{{owner}}/{{repo}}/settings/actions> → **Workflow permissions** → **Allow GitHub Actions to create and approve pull requests**.
   - **Trusted Publisher** (if the project publishes to npm and the upgrade introduces a release.yml change): verify the publisher config still matches at <https://www.npmjs.com/package/{{package}}/access>. Workflow filename should match the entry-point (`release-please.yml` for the standard flow).
   - **Pending release-please PR?** If the project has open release PRs (from kit-side template changes that affect this project), link to them: <https://github.com/{{owner}}/{{repo}}/pulls?q=is%3Apr+is%3Aopen+label%3Aautorelease%3A+pending>.

## Things to be careful about

- **User-customized scaffold files** — `biome.json` may have project-specific ignores, `package.json` may have unrelated deps. Always diff before overwriting.
- **CLAUDE.md project-specific section** — the `## Project-specific` section is owned by the project. Never touch it.
- **`@`-ref path changes** — when a kit module gets renamed (e.g. `modules/hono` → `templates/hono-api`), the project's `CLAUDE.md` refs break silently. Catch and update.
- **Deps with breaking changes** — when the kit bumps a major version of a shared dep (`@effect/platform 0.x` → `0.x+1` with API changes), don't just run `pnpm update`. Tell the user, link to the upstream migration notes, let them schedule the work.

## Refuse to do

- Don't auto-apply structural changes without explicit user confirmation.
- Don't touch `src/` business code.
- Don't run `pnpm update` blindly — that bypasses the project's cooldown / trust policy.
- Don't squash multiple unrelated changes into one commit.

## Conventions to honor

- **No PRs, no worktrees.** Work directly on `main`.
- **Commit per change** when the changes are independent. Bundled commits only when the user explicitly wants a single "upgrade kit to <SHA>" commit.
- **Report the new kit SHA** so the user can verify what version they're now on.
