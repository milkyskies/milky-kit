---
name: upgrade
description: Upgrade a project that was scaffolded from milky-kit. Reads the project's .milky-kit-version, diffs the kit's git log since that SHA, and walks the user through each change that affects this project's stack — with judgment, because every project diverges from the kit over time.
---

# Upgrade an existing milky-kit project

Use this skill to bring a project up to date with the latest milky-kit. It's deliberately manual: the kit can move in ways that don't apply cleanly to every project (the user may have customized biome.json, the scaffold's `package.json` may have diverged, a module may have been renamed). The skill walks each change as a discrete decision rather than blindly running a merge.

## When to invoke

User says any of: "upgrade milky-kit", "check for milky-kit updates", "/milky-kit:upgrade", "what changed in the kit?". Or after `milky-kit:check-version` reports the project is behind.

## Detect first

1. Read `./.milky-kit-version` at the project root. Extract the **base SHA**, the **template**, the list of **applied modules**, and the **variants** line (`variants: runtime=workers, db=d1, ...`). Older files may carry a `<template>:` prefix after `variants:` (`variants: hono-api: db=d1, api_style=openapi, auth=none`); read it the same way. A missing line, or an axis the line does not list, falls back to that axis's `default` in the template's `module.toml`.
2. If the file doesn't exist, suggest running `/milky-kit:retrofit` instead — the project wasn't scaffolded from the kit (or pre-dates the version-tracking convention).
3. Read `git -C ~/.claude/kit rev-parse HEAD` for the **current kit SHA**.
4. If `base == current`, report "you're already up to date" and exit.

## Compose the effective scaffold

A template's `scaffold/` directory is only the base. What a project received is the base plus its variant overlays, so diff and copy that composed set, never the raw `scaffold/` tree. A variant change that moves a file between `scaffold/` and an overlay (for example Workers pieces moving into `variants/runtime/workers`) then shows up as no change at all.

Compose the set twice, once at the project's base SHA and once at the current kit, with the same recorded variants:

1. Start from `templates/<template>/scaffold/`.
2. Apply each axis in the order `module.toml` documents, copying `variants/<axis>/<choice>/` over the result with the same merge rules as the `new` skill's step 4 (JSON and JSONC merge by key, arrays replace, everything else overwrites).
3. Delete every path in `[variants.<axis>.<choice>] remove` after that overlay.
4. Substitute placeholders and strip the `_` prefix, as the `new` skill does.

Read the base-SHA version with `git -C ~/.claude/kit archive <base> templates/<template> | tar -x -C <scratch>`, never by checking out the kit. A file in the old composed set and not in the new one is a real removal; a file in the new set and not in the old one is an addition. When the current `module.toml` has an axis the base did not (a new axis), compose the old set without it and the new set with its `default`, so a project that never chose it lands on the default.

## Build the upgrade plan

Run `git -C ~/.claude/kit log --oneline <base>..HEAD -- <paths>` filtered to the paths the project cares about:

- `templates/<applied-template>/**`
- For each applied module: `modules/<module>/**`
- Always: `modules/core/**`, `modules/ts/**` (TS projects)
- The kit's `README.md` and root `CLAUDE.md` (for kit-wide convention changes)

Group the commits into themes. For each, decide whether it's:

- **Mechanical** — a rule file changed, a scaffold file got a small tweak. Show diff; user accepts or skips.
- **Structural** — a module was renamed, a paradigm rule was added that will fail lint. Walk through implications: "module X is now Y; we'd need to retarget the `.claude/rules/<rule>.md` symlink. Continue?"
- **Optional** — a new module was added. Ask if the user wants to apply it (same flow as `retrofit` for that module).
- **Breaking** — paths moved, a dep was upgraded with breaking changes. Explain what will break and ask before touching anything.

## Steps to execute per change

For each change the user accepts:

1. **Apply the diff** to the project. For scaffold files, copy the new version from the composed set over the project's copy — but only after showing the diff. For rule symlinks whose kit target moved, retarget `.claude/rules/<rule>.md` to the new path (or run `/milky-kit:retrofit`, which reconciles symlinks idempotently).
2. **Run lint + typecheck** after each substantive change. New rules will surface new violations — let the user decide which to fix now vs file as TODOs.
3. **Commit** with a clear scope: `chore: upgrade milky-kit <description>` referencing the kit commit SHA in the body.

After all changes are applied (or skipped):

1. **Scan `.claude/rules/` for broken symlinks.** Now that the kit has moved, some kit-pointed symlinks may point at files that were renamed or deleted. Detect by reading each symlink's target and checking it resolves to a real file. Propose fixes (retarget to new path, or remove if the rule was deleted) — or invoke `/milky-kit:retrofit` which reconciles automatically. Walk one at a time.
2. **Invoke the `realign` skill.** Pass it the list of rules that changed in this upgrade so realign focuses on those rather than scanning everything. The user accepts/skips each violation realign finds.
3. **Update `.milky-kit-version`** to the new kit SHA + new timestamp. Preserve the template, modules and variants lines, and add any new axis with the default value it fell back to.
4. **Final summary** — applied N, skipped M, what's still TODO, plus manual setup steps the user must complete (with direct links). Substitute `{{owner}}`, `{{repo}}`, `{{package}}`.

   Always check and surface (skip the ones that don't apply):

   - **Symlink stale?** If `~/.claude/kit` is missing or points to the wrong place, the `.claude/rules/` symlinks won't resolve. Quick check: `ls -la ~/.claude/kit`. Fix: `ln -s <kit-checkout-path> ~/.claude/kit`.
   - **Workflow permissions** (if release-please module is active and the project hasn't enabled this): <https://github.com/{{owner}}/{{repo}}/settings/actions> → **Workflow permissions** → **Allow GitHub Actions to create and approve pull requests**.
   - **Trusted Publisher** (if the project publishes to npm and the upgrade introduces a release.yml change): verify the publisher config still matches at <https://www.npmjs.com/package/{{package}}/access>. Workflow filename should match the entry-point (`release-please.yml` for the standard flow).
   - **Pending release-please PR?** If the project has open release PRs (from kit-side template changes that affect this project), link to them: <https://github.com/{{owner}}/{{repo}}/pulls?q=is%3Apr+is%3Aopen+label%3Aautorelease%3A+pending>.

## Migration: ghlobes to issues

Run this when the project's `.milky-kit-version` lists `ghlobes`, or `.claude/rules/glb.md` or `.ghlobes.toml` exists. Confirm with the user first, then walk the steps in order.

1. **Rule link.** Remove the `.claude/rules/glb.md` symlink. Link `.claude/rules/issues.md` to `~/.claude/kit/modules/issues/rules/issues.md`. Replace `ghlobes` with `issues` in the module list inside `.milky-kit-version`.
2. **Labels.** Copy `~/.claude/kit/modules/issues/scaffold/.github/scripts/setup-labels.sh` to `.github/scripts/setup-labels.sh`, make it executable, and run it. It needs only an authenticated `gh`.
3. **Relabel every open issue** from its Projects status to its stage label, using this mapping:

   | Projects status | Stage label |
   |---|---|
   | Backlog | `stage:backlog` |
   | Todo | `stage:ready` |
   | In Progress | `stage:working` |
   | Needs Decision | `stage:needs-you` |
   | In Review | `stage:check` |
   | Done | `stage:done` (the issue is already closed; label it anyway) |

   Read each status with `gh project item-list <project-number> --owner <owner> --format json --limit 200` (project number and owner come from `.ghlobes.toml`, so read them before step 4), or with `gh api graphql` against the project items. Apply the label with `gh issue edit <n> --add-label <stage label>`. An open issue with no status gets `stage:backlog`. Print the full issue-to-label table and get the user's go-ahead before editing anything.
4. **Config.** Delete `.ghlobes.toml`.
5. **Commit** the removed config, the new script and the relinked rule as `chore: move issue tracking from ghlobes to labels`.

The old GitHub Project stays in place. The user can close or delete it once the labels look right.

## Migration: autopilot to frontdesk

Run this when the project's `.claude/rules/` holds a symlink to the old autopilot rule, or the project's `.claude/rules.manifest` lists it. Confirm with the user first, then walk the steps in order.

1. **Rule link.** Remove the symlink to the old autopilot rule. Link `.claude/rules/frontdesk.md` to `~/.claude/kit/modules/frontdesk/rules/frontdesk.md`. Replace `autopilot` with `frontdesk` in the module list inside `.milky-kit-version`.
2. **Run the migration program.** `~/.claude/kit/modules/frontdesk/bin/frontdesk migrate --dry-run` lists every change and writes nothing. Show the list to the user. After their go-ahead, run `frontdesk migrate`. It rewrites the old rule's name to `frontdesk.md` in `.claude/rules.manifest`, runs `mise run rules:link`, and rewrites the old `autopilot` comment markers on every open issue to the `frontdesk` markers, printing each change.
3. **CLAUDE.md.** Replace the old `## Implementation tiers` and `## Correctness-critical paths` sections with the `## frontdesk` section from `~/.claude/kit/modules/frontdesk/frontdesk-section.md`: tiers become `### Hard areas`, correctness-critical paths become `### Review paths`. Show the diff first. The `## Project-specific` section stays untouched.
4. **Preflight.** Run `frontdesk preflight --role coordinator` and surface each fix it prints. The `autopilot` label stays as it is, because it is the consent gate.
5. **Commit** as `chore: move autopilot to the frontdesk module`.

## Things to be careful about

- **User-customized scaffold files** — `biome.json` may have project-specific ignores, `package.json` may have unrelated deps. Always diff before overwriting.
- **CLAUDE.md project-specific section** — the `## Project-specific` section is owned by the project. Never touch it.
- **Symlink target moves** — when a kit module gets renamed (e.g. `modules/hono` → `templates/hono-api`), the project's `.claude/rules/` symlinks point at the old path and break silently. Catch and retarget (or re-retrofit).
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
