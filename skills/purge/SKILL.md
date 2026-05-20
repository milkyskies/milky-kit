---
name: purge
description: Remove milky-kit's footprint from the CURRENT PROJECT so it can be re-retrofitted cleanly. Removes .claude/rules/ symlinks that point into the kit, and the .milky-kit-version file. Does NOT touch scaffold files (CI workflows, biome.json, etc.) or CLAUDE.md — those are project-owned. Does NOT touch the Claude Code plugin or the ~/.claude/kit symlink (those are machine-level — use /plugin uninstall for those).
---

# Purge milky-kit from this project

Use this skill when the user wants to clear the kit's per-project footprint so they can re-run `/milky-kit:retrofit` against a clean slate. Common reasons: the kit reshuffled modules (e.g. today's effect split moved `effect.md`), a project's module selection changed, or symlinks are pointing at stale paths.

This is **per-project**, not machine-level. The kit's git checkout, the `~/.claude/kit` symlink, the Claude Code plugin, and the marketplace entry all remain — only the current project's kit-managed pointers are removed.

## When to invoke

User says any of: "purge milky-kit from this project", "reset milky-kit here", "remove the kit's rules from this project", "/milky-kit:purge", "I want to re-retrofit from scratch".

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
