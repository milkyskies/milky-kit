---
name: purge
description: Escape hatch — fully remove milky-kit's per-project footprint when a project is abandoning the kit. Removes .claude/rules/ symlinks that point into the kit, and the .milky-kit-version file. Does NOT touch scaffold files (CI workflows, biome.json, etc.) or CLAUDE.md — those are project-owned. Does NOT touch the Claude Code plugin or the ~/.claude/kit symlink (those are machine-level — use /plugin uninstall for those). For the common case of pulling updated kit content into an existing project, use /milky-kit:retrofit, which is idempotent.
---

# Purge milky-kit from this project

Use this skill when the user wants to fully clear the kit's per-project footprint — typically when a project is abandoning the kit, or when something has gone wrong enough that a full reset is the cleanest fix.

For the common case — "the kit moved a rule and my symlinks are stale" or "I want to add/remove a module" — use `/milky-kit:retrofit` instead. Retrofit is idempotent (see PR #74); re-running it adds new symlinks, retargets ones whose source moved, and removes ones for de-selected modules. Purge is the escape hatch, not the standard pre-retrofit step.

This is **per-project**, not machine-level. The kit's git checkout, the `~/.claude/kit` symlink, the Claude Code plugin, and the marketplace entry all remain — only the current project's kit-managed pointers are removed.

## When to invoke

User says any of: "abandon milky-kit", "remove all the kit's content from this project", "full reset of milky-kit here", "purge milky-kit", "/milky-kit:purge".

**Do NOT invoke for:** "pull updated kit content" / "the kit moved something and my symlinks broke" / "I want to add module X" — those are retrofit's job (it handles all three idempotently).

## What gets removed

- Every symlink under `.claude/rules/` whose target resolves into `~/.claude/kit/` (or any path containing `milky-kit`).
- `.milky-kit-version`.

## What does NOT get removed (and why)

- **Scaffold files** (`.github/workflows/*.yml`, `biome.json`, `mise.toml`, `.ghlobes.toml`, `docker-compose.yml`, etc.). These were copied at retrofit/scaffold time and are project-owned forever — the user has likely edited them. The user can delete any they don't want manually.
- **`CLAUDE.md`.** Owned by the project, especially the `## Project-specific` section. The kit never touches this.
- **`.claude/rules/` symlinks pointing OUTSIDE the kit** — e.g. project-local rules the user wrote that live in the same directory. Only kit-pointed symlinks get removed.
- **Real files in `.claude/rules/`.** If the user committed actual files (not symlinks) there, leave them alone and surface their existence.
- **The kit checkout, `~/.claude/kit`, the Claude Code plugin, the marketplace entry.** Machine-level. Removing those requires `/plugin uninstall` + `rm ~/.claude/kit` and is not this skill's job.

## Flow

1. **Survey what would be removed.** Don't delete anything yet. Build the list:

   ```bash
   # Symlinks under .claude/rules/ pointing into the kit
   find .claude/rules -maxdepth 1 -type l 2>/dev/null | while read link; do
     target=$(readlink "$link")
     case "$target" in
       *.claude/kit/*|*milky-kit/*) echo "SYMLINK: $link -> $target" ;;
     esac
   done

   # .milky-kit-version
   [ -f .milky-kit-version ] && echo "FILE: .milky-kit-version ($(cat .milky-kit-version | head -1))"

   # Warn about non-symlink files in .claude/rules/ (will be skipped)
   find .claude/rules -maxdepth 1 -type f 2>/dev/null | while read file; do
     echo "WILL SKIP (real file, not a symlink): $file"
   done
   ```

2. **Show the user the survey and ask to confirm.** Use `AskUserQuestion` with Yes / No (Recommended: Yes). If anything in `.claude/rules/` is a real file, list it explicitly so the user knows it stays.

3. **Remove the kit symlinks and `.milky-kit-version`.** One `rm` per item — never `rm -rf`:

   ```bash
   # For each kit-pointed symlink from step 1:
   rm "<link-path>"

   # If .milky-kit-version exists:
   rm .milky-kit-version
   ```

4. **Leave `.claude/rules/` itself** even if it's now empty — `/milky-kit:retrofit` will repopulate it. If `.claude/` is now empty entirely, also leave it.

5. **Report what happened**:

   ```
   Purged from <project-path>:
   - <N> kit symlinks under .claude/rules/
   - .milky-kit-version

   Left in place (project-owned):
   - Scaffold files: <list, e.g. .github/workflows/ci.yml, biome.json, mise.toml, .ghlobes.toml>
   - CLAUDE.md
   - <any non-symlink files in .claude/rules/ if present>

   Re-retrofit with:  /milky-kit:retrofit
   ```

   If the project still has scaffold files the user might want gone (CI workflows, biome.json with `extends @milkyskies/biome-config`, etc.), list them so the user can `rm` what they want manually.

## Guardrails

- **Always survey + confirm before deleting.** No silent removal.
- **Never `rm -rf`.** Only `rm` on individual symlinks + `.milky-kit-version`.
- **Never delete real files** under `.claude/rules/` (only symlinks pointing into the kit).
- **Never touch scaffold files** (`.github/workflows/*.yml`, `biome.json`, `mise.toml`, `.ghlobes.toml`, `docker-compose.yml`, `package.json`, `tsconfig.json`, etc.). These are project-owned.
- **Never touch `CLAUDE.md`.** Always project-owned.
- **Never touch machine-level state** (`~/.claude/kit`, the plugin, the marketplace). That's outside this skill's scope — point the user at `/plugin uninstall milky-kit@milkyskies` + `rm ~/.claude/kit` if they want that.
- **Never run `git` commands.** Removed files show up in `git status`; let the user commit when they're ready.
