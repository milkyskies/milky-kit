---
name: purge
description: Uninstall milky-kit cleanly from this machine — removes the Claude Code plugin, the marketplace entry, and the ~/.claude/kit symlink. Use when reinstalling from scratch or fully removing the kit. Does NOT touch consuming projects' .claude/rules/ symlinks or the kit's git checkout itself; both are user-owned.
---

# Purge milky-kit from this machine

Use this skill when the user wants to fully remove milky-kit so they can reinstall, or when they're done with the kit and want a clean machine.

## When to invoke

User says any of: "purge milky-kit", "remove milky-kit", "uninstall the kit", "reset milky-kit", "/milky-kit:purge", "I want to reinstall the kit from scratch".

## What gets removed

- The Claude Code plugin (`milky-kit@milkyskies`).
- The Claude Code marketplace entry (`milkyskies`).
- The `~/.claude/kit` symlink (if it's a symlink — never a real directory).

## What does NOT get removed (and why)

- **The kit's git checkout** (wherever the user cloned `milky-kit` to). That's user-owned, may have uncommitted work, and is needed for reinstall anyway. Tell the user the path; let them rm it if they want.
- **Consuming projects' `.claude/rules/` symlinks.** Those break harmlessly once `~/.claude/kit` is gone, and the next `/milky-kit:retrofit` re-creates them. Auto-cleaning per-project state is too destructive for a machine-level purge.
- **Consuming projects' scaffold files** (CI workflows, biome configs, etc.) — those were copied at scaffold time and are project-owned forever.

## Flow

1. **Confirm with the user before doing anything.** This is destructive. Print:

   ```
   This will:
   - Uninstall the milky-kit Claude Code plugin
   - Remove the milkyskies marketplace entry
   - Delete the ~/.claude/kit symlink

   It will NOT touch:
   - The kit's git checkout at <path>
   - Any consuming project's .claude/rules/ or scaffold files

   Proceed?
   ```

   Use `AskUserQuestion` with a Yes / No (Recommended: Yes).

2. **Show the slash commands the user must run themselves** (Claude Code's `/plugin` commands aren't invokable from skills — the user types them in):

   ```
   /plugin uninstall milky-kit@milkyskies
   /plugin marketplace remove milkyskies
   ```

   Tell them to run those two first, then come back so the skill can finish.

3. **Once the user confirms the plugin commands ran**, remove the `~/.claude/kit` symlink:

   ```bash
   if [ -L ~/.claude/kit ]; then
     rm ~/.claude/kit
     echo "Removed ~/.claude/kit symlink"
   elif [ -e ~/.claude/kit ]; then
     echo "ERROR: ~/.claude/kit is not a symlink — refusing to delete. Resolve manually."
     ls -la ~/.claude/kit
   else
     echo "~/.claude/kit was not present"
   fi
   ```

   **Never `rm -rf`** the path. If it's a real directory (someone moved the kit into `~/.claude/kit` directly instead of symlinking), refuse and let the user resolve.

4. **Report what the kit checkout's path was** so the user can `rm -rf <path>` it themselves if they want. Do NOT delete it for them.

   ```bash
   readlink ~/.claude/kit 2>/dev/null || echo "(no symlink to read)"
   ```

5. **Print the reinstall command sequence** so the user can paste it back in when ready:

   ```
   To reinstall:

   git clone https://github.com/milkyskies/milky-kit <wherever-you-keep-projects>/milky-kit
   ln -s <wherever-you-keep-projects>/milky-kit ~/.claude/kit
   ls -la ~/.claude/kit  # verify it resolves

   Then, in any Claude Code session:
     /plugin marketplace add milkyskies/milky-kit
     /plugin install milky-kit@milkyskies
   ```

## Guardrails

- **Always confirm before any destructive step.** No silent removal.
- **Never `rm -rf`** anything. Only `rm` on the symlink itself.
- **Refuse to delete `~/.claude/kit` if it's a real directory**, not a symlink. Surface the situation; let the user resolve.
- **Never touch consuming projects.** The skill operates only on plugin state + the one symlink.
- **Never run the `/plugin` commands "via Bash" workaround.** Those are interactive Claude Code commands — hand off to the user per the "hand off interactive steps" rule.
