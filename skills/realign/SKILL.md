---
name: realign
description: Scan a project against its currently-loaded milky-kit rules and propose changes to bring the code, configs, and CLAUDE.md back into alignment. Read-the-rules-then-find-violations workflow. Other skills (upgrade, retrofit, edit, kit-modify) call this as their final step. Use when the user says "realign", "check this against the rules", "what's drifted from milky-kit?".
---

# Realign a project to its milky-kit rules

**Designed for**: whole-repo drift sweep after kit-side or project-side change — what's drifted from the kit's current rules? Scans the entire codebase, not just changed lines. Slower than `/rulify` (which is diff-scoped for tight pre-PR feedback) but broader. Other skills (`upgrade`, `retrofit`, `edit`, `kit-modify`) call this as their last step. It can also be invoked directly when a user wants to know what's drifted.

## When to invoke

- Directly: user says "realign this project", "check against the kit rules", "what's drifted?", "/milky-kit:realign".
- Indirectly: invoked by `upgrade` (after applying kit-side changes), `retrofit` (after adding modules), `edit` (after modifying code), `kit-modify` (after the kit-side change is pushed).

## Phases

### Phase 1 — Read the active ruleset

1. List `.claude/rules/*.md` entries. For each symlink whose target resolves into `~/.claude/kit/` (or any path containing `milky-kit`), read the kit-side target file. For real (non-symlink) files in `.claude/rules/`, read those as project-local rules.
2. Resolve every target path (handling `~`, `./`, `~/.claude/kit/...` as needed).
3. Build a checklist of concrete, mechanically-checkable rules. Examples:
   - "biome.json extends `@milkyskies/biome-config`"
   - "no `console.log` in Effect code (use `Effect.log*`)"
   - "no `throw` in business logic (use `Effect.fail` + `Data.TaggedError`)"
   - "no `T | null` or `T | undefined` in domain (use `Option`)"
   - "no `Promise.all` (use `Effect.all` with explicit `{concurrency}`)"
   - "no `if/else if` chains where `Match` fits"
   - "presentation handlers are 3-line shims, no inline `Effect.gen` blocks"
   - "use cases live in `application/use-case/<verb>-<resource>.ts`"
   - "every workspace package has `typecheck`/`lint`/`test` scripts"
4. Note which rules are paradigm-specific (only apply when `effect.md` is loaded).

### Phase 2 — Scan the codebase for violations

For each mechanically-checkable rule, grep / read across the project. Examples:

- `grep -r 'console\.log' src/` for Effect projects
- `grep -r 'throw new' src/application src/domain` (presentation can throw; business can't)
- `grep -rE '\bas \w+' src/` for forbidden type casts (paired with a check that the `as` isn't at a known system boundary)
- `find src/presentation -name '*.ts' -exec wc -l` and sample for inline `Effect.gen` blocks > 3 lines
- Read each workspace `package.json` and verify scripts
- Read `biome.json` and verify `extends`
- Diff `.claude/rules/` kit-pointed symlinks against what the kit currently offers — flag symlinks whose target file no longer exists or moved

Collect findings. Group by file and by rule.

### Phase 3 — Propose changes (don't auto-apply)

Print a structured list:

```
File: src/application/use-case/create-post.ts:42
Rule: effect.md — no `throw` in business logic
Found: `throw new Error("title required")`
Suggest: `Effect.fail(new TitleRequired({ title: input.title }))`
         + define TitleRequired with Data.TaggedError
```

For each proposal, ask user via `AskUserQuestion`: accept, skip, or "show me the full diff first".

### Phase 4 — Apply accepted changes

For each accepted change:

1. Edit the file using the `Edit` tool. One change per edit (no batching across rules unless the user explicitly says "apply all of these").
2. Run `pnpm -r typecheck` / equivalent after each substantive change. If typecheck breaks, surface the error and ask before continuing.
3. Commit with a focused message: `refactor(<scope>): realign to <rule>`. Reference the rule file (e.g. `closes` no issue but `refs modules/effect/rules/effect.md` in the body).

### Phase 5 — Fix broken kit symlinks if needed

If the scan found `.claude/rules/` symlinks whose kit target moved or was deleted, fix them in the same realign pass: `rm` the broken symlink and either re-create it pointing at the new path (if the rule was renamed) or leave it removed (if the rule was deleted). For substantial reshuffles, suggest running `/milky-kit:retrofit` instead — retrofit's idempotent reconciliation handles this case natively.

## Things realign refuses to do

- **Auto-apply changes** without user consent. Each violation gets its own y/n.
- **Touch the `## Project-specific` section** of CLAUDE.md. That's project-owned forever.
- **Modify `src/` business logic to "fit a rule"** if the change isn't mechanical. Realign reports the violation and proposes; complex refactors get a comment marker (`// TODO: realign — <rule>`) and the user fixes by hand.
- **Run `pnpm update` or any package version change.** Realign is about *current* code conforming to *current* rules. Version changes belong to `upgrade`.

## Output format

End with a summary:

```
Realign report — 2026-05-19
Rules checked:    14
Violations found: 6
Applied:          4
Skipped:          2
Still TODO:       0
```

And the project's lint + typecheck pass status:

```
pnpm -r lint:       ✓
pnpm -r typecheck:  ✓
pnpm -r test:       ✓
```

If anything failed after the realign, list it explicitly so the user knows what to follow up on.
