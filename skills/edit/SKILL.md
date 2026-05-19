---
name: edit
description: Modify code in a milky-kit project, then automatically realign to the current rules. Wraps regular Edit/Write workflows with a guaranteed post-edit rule check, so changes never drift the project off-spec. Use when the user describes a code change ("add a delete endpoint", "rename this field", "extract this into a use case") and wants the rule alignment baked in.
---

# Edit + auto-realign

A thin wrapper around the regular code-edit workflow that adds a guaranteed post-edit rule check via the `realign` skill. Use this when the user asks for a code change that touches business logic, and you want the kit's rules enforced as part of the same turn.

## When to invoke

- User describes a feature / bug fix / refactor in a milky-kit project.
- User says "edit this and make sure it follows the rules" or similar.
- Any time a code change crosses the presentation / application / infrastructure / domain layers — realign catches layering violations.

## Don't invoke for

- Pure rule-file edits (no code change). Use direct Edit / `kit-modify`.
- One-line typo fixes that obviously can't violate rules.
- Generating new files from scratch that the kit's scaffold should produce — use `new` or `retrofit` instead.

## Flow

1. **Plan the edit** with the user. If non-trivial, use the planning tools to confirm scope before touching files.
2. **Apply the changes** via `Edit` / `Write` / refactor steps. Make the diff. Run typecheck/lint after each substantive change.
3. **Commit the change** with a clear scope: `feat(<scope>): <what>` referencing any glb issue numbers.
4. **Invoke `realign`** as a follow-up step on the changed files. Realign scans the just-touched paths against current rules and proposes any needed cleanup.
5. **Apply realign's proposals** one at a time, committing each as `refactor(<scope>): realign — <rule>`.
6. **Final check**: `pnpm -r typecheck && pnpm -r lint && pnpm -r test`. Report pass/fail.

## Things `edit` enforces

- **Every operation goes through a use case.** If the user asks for "a delete endpoint", the edit creates `application/use-case/delete-post.ts` AND wires `presentation/http/post-handlers.ts` to call it. Never `db.delete(...)` inline in a handler.
- **Errors as `Data.TaggedError`.** New error conditions get a new tagged error, not a `throw`.
- **Schemas at boundaries.** New input shapes are `Schema.Struct` (or `Schema.Class`) — never raw TS types crossing a layer.
- **Tests colocated with the code.** When adding a function, add a test file next to it (`foo.ts` + `foo.test.ts`).
- **No commented-out code.** If the change removes something, it's gone.

## Refuses to

- Skip the realign step. The whole point is that edits stay aligned.
- Bypass typecheck failures to "fix later". A broken type signature means the edit isn't done.
- Touch the `## Project-specific` section of CLAUDE.md.

## Conventions to honor

- **No PRs, no worktrees.** Work directly on `main`.
- **Commit per logical change.** A feature edit + its realign-driven refactor each get their own commit.
- **Reference glb issue numbers** in commit messages when the user has issues tracking the change.
