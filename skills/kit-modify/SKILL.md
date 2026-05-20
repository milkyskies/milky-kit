---
name: kit-modify
description: Modify milky-kit itself from within a consuming project. Edits the kit checkout, commits + pushes to the kit's git remote, then realigns the current project against the updated rules. Use when the user notices a kit-level convention worth changing while working on a project — captures the change at the source without losing focus.
---

# Modify milky-kit from a consuming project

Use this skill when the user is working in a project and decides a kit-level convention should change. Instead of context-switching to the kit repo, this skill edits the kit checkout, commits + pushes, and then realigns the current project so the change is in effect immediately.

## When to invoke

- User says "let me add this rule to milky-kit", "this should be a kit rule", "update the kit to ...", "/milky-kit:kit-modify".
- Recognized phrasings that imply the change should propagate to other projects: "let's make this a convention", "every Effect project should ...", "the rule should be ...".

## When NOT to invoke

- Project-specific rules. Those go in the project's CLAUDE.md under `## Project-specific`, not in the kit.
- Speculative rules ("maybe we should..."). The kit accretes too fast if speculation lands as rules. Ask the user to commit to it explicitly.
- Changes the user hasn't agreed to. Always confirm the wording of the new rule before touching the kit.

## Flow

1. **Locate the kit checkout.** Read `~/.claude/kit` (symlink target) or `~/Code/Projects/milky-kit`. If neither exists, abort and tell the user the kit needs to be on this machine first.

2. **Confirm the scope of the change.** Ask:
   - Which file in the kit? (`modules/effect/rules/effect.md`, `modules/core/rules/general.md`, etc.)
   - What's the new content? (full sentence, not a fragment)
   - Why does it belong in the kit (not just this project)?

3. **Edit the kit file.** Use `Edit` / `Write` on the kit's path. Do not stage anything in the current project at this stage.

4. **Commit in the kit's repo.** `git -C <kit_path> commit -am "<scope>(<area>): <change>"`. Conventional commit format, matching milky-kit's existing style. If the user has a glb workflow in the kit, ask whether to also create an issue there.

5. **Push to the kit's remote.** `git -C <kit_path> push origin main`. The kit doesn't use PRs (per the kit's own rules); commits land on main directly.

6. **Update the current project's `.milky-kit-version`** to the new kit SHA. This keeps the project's version pointer accurate.

7. **Realign the current project.** Invoke the `realign` skill. The new kit rule may surface violations in this project's code; walk those one at a time.

8. **Notify the user about other consuming projects** with explicit pointers, not vague prose. Tell them:

   - Rules update **automatically** in any project whose `.claude/rules/<rule>.md` symlinks at the changed file — next Claude session loads the new content. No action needed.
   - Scaffold files (workflows, configs) DON'T update automatically. To pull the kit's change into a consuming project, in that project run `/milky-kit:upgrade`. The skill diffs against `.milky-kit-version` and walks each change.
   - If a consuming project is on a different machine, that machine also needs `~/.claude/kit` symlinked at the kit checkout. Direct check: `ls -la ~/.claude/kit`. If missing: `ln -s <path-to-kit-checkout> ~/.claude/kit`.
   - View the just-pushed kit commit at <https://github.com/{{kit_owner}}/{{kit_repo}}/commits/main>.

## Guardrails

- **Confirm the kit edit before pushing.** Show the user the exact diff that will land in milky-kit. They can amend the wording before the commit.
- **Never `--force` push.** The kit may be referenced by other machines/projects via the `~/.claude/kit` symlink and the `.claude/rules/` symlinks that resolve through it; force-pushing rewrites their dependency.
- **Don't bundle unrelated changes.** One conceptual change per kit commit. If the user describes two ideas, ask whether to do them as separate commits.
- **Don't modify the kit's own `.git/` state** (config, hooks, etc.) without explicit instruction.

## Conventions to honor

- **Kit commits follow `<type>(<scope>): <subject>`.** Examples: `feat(effect-api): require use cases for every operation`, `docs(comments): forbid hand-wrapped lines`.
- **Stay focused.** While in the kit, only make the user's requested change. Don't fix unrelated kit issues you happen to notice — file a glb issue instead (or just leave it).
- **Report the kit SHA after pushing.** The user sees what version their project is now anchored to.
