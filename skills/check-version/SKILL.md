---
name: check-version
description: Show which version of milky-kit a project was scaffolded against, compare to the current kit checkout, and list what's changed since. Read-only — does not modify anything. Use when the user asks "am I on the latest milky-kit?", "/milky-kit:check-version", or before deciding whether to run /milky-kit:upgrade.
---

# Check milky-kit version

Read-only: prints the project's recorded kit SHA, the current kit SHA, and a summary of changes since. Does not modify the project. Pair with `/milky-kit:upgrade` to actually apply changes.

## When to invoke

User says: "what version of milky-kit am I on?", "is the kit up to date?", "/milky-kit:check-version", "should I upgrade?".

## Steps

1. **Read `./.milky-kit-version`** at the project root.
   - If missing: report "no .milky-kit-version file — this project may not have been scaffolded from milky-kit, or it predates version tracking. Run `/milky-kit:retrofit` to adopt the convention." Exit.
   - Extract: base SHA, scaffold timestamp, template, modules list.

2. **Read the kit's current SHA** via `git -C ~/.claude/kit rev-parse HEAD`.

3. **Compute the gap** via `git -C ~/.claude/kit log --oneline <base>..HEAD | wc -l` and `git -C ~/.claude/kit log -1 --format='%ad' --date=short <base>`.

4. **Print a summary** like this:

   ```
   Project:      <project name>
   Scaffolded:   <base SHA short> on <timestamp>
   Template:     <template>
   Modules:      <comma-separated>

   Kit checkout: <current SHA short>
   Commits behind: <N>  (since <base date>)
   ```

5. **If behind**, run `git -C ~/.claude/kit log --oneline <base>..HEAD --no-merges -- templates/<template> modules/core modules/ts <each-applied-module>` and print the first ~20 lines. Group by theme if obvious.

6. **Suggest next steps:**
   - If 0 commits behind: "you're up to date."
   - If <5 commits behind: "consider running `/milky-kit:upgrade` to review changes."
   - If 5+ commits behind: "the kit has moved substantially; `/milky-kit:upgrade` will walk through changes one at a time."

## Refuse to do

- Don't write to the project.
- Don't run `git fetch` on the kit checkout. The user controls when the kit is updated; this skill just reports.
- Don't suggest unrelated changes — only the milky-kit version question.

## If `~/.claude/kit` doesn't exist

Tell the user: "milky-kit is expected to be symlinked at `~/.claude/kit`. Run `ln -s ~/Code/Projects/milky-kit ~/.claude/kit` (or wherever your milky-kit checkout lives) so the `.claude/rules/` symlinks resolve to live kit files. See milky-kit's README for setup."
