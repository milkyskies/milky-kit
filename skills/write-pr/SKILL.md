---
name: write-pr
description: >
  Compose a PR description in the kit house format: layered sections (Overview, Architecture
  diagrams, Contents, Design decisions, Verification), an embedded architecture-diagram block, and
  `closes #<num>` for the GitHub issue. Returns the markdown body for `gh pr create`.
  TRIGGER when: creating or updating a PR body (invoked by /ship), or the user says "write the PR",
  "PR description", "draft the PR body".
  DO NOT TRIGGER when: the user only wants tests/quality gates, or a non-PR commit message.
argument-hint: "[issue number (optional, inferred from branch)]"
---

# write-pr

Compose the PR description for this branch. Output the markdown body only — `/ship` (or the user) runs `gh pr create`. **Invoke `/arch-diagrams` for the diagram section.**

## Procedure

1. Infer the issue number from the branch (`feature/#123.foo` → `123`); confirm via `git log`/diff what actually changed. Get the issue title from `glb show <num>`.
2. Classify changed files into layers (presentation / application / domain / infrastructure, or frontend / api / backend) — this drives Contents.
3. **Call `/arch-diagrams`** and embed its output as the Architecture diagrams section.
4. Read the issue (`glb show <num>`) and any referenced ADR/doc to fill Overview and Design decisions accurately.
5. Emit the body below. **The first line must be `closes #<num>`** so GitHub auto-closes the issue on merge.

## Section template (markdown `##` headers)

Required: Overview, Architecture diagrams, Contents, Verification. Others when they apply.

### `closes #<num>` (first line, before any header)

### 1. `## Overview`
- One-line summary: what this PR does. For a multi-PR epic prefix with `{epic} — PR{k}:` and a tag like `[additive]` (flags "no behavior change").
- If an ADR/doc exists: `See docs/adr/.../ for the design.`
- A problem + scope paragraph: what it solves, and explicitly what this PR does vs. defers.

### 2. `## Architecture diagrams`
- The block returned by `/arch-diagrams`. Skip only for a docs-only / config-only PR with no code structure.

### 3. `## Contents`
- Subsections by layer (`### domain` / `### infrastructure` / `### frontend` …), each a bullet list of concrete artifacts. Mirror the layers the Change Map shows.

### 4. `## Design decisions`
- Bullets, each a decision + rationale. Include only non-obvious choices a reviewer might otherwise rewrite. Omit the section if there are none.

### 5. `## Verification`
- What was actually run, declaratively (not a checkbox wishlist): the formatter/linter/test commands for this stack (e.g. `cargo nextest run -p <pkg>`, `pnpm --filter <app> check`), green status, and any caveats (integration tests need a DB, etc.).

### 6. `## Notes` (optional)
- Honest caveats — bundled commits, follow-ups, things you'd split differently.

### 7. `## Dependencies` (optional)
- A PR-slice diagram for multi-PR epics:
  ```
  PR1 ┐
  PR2 ├─→ PR4(cutover) ─→ PR5
  PR3 ┘
  ```

## Ticket linking

The kit tracks work in **GitHub issues** (via glb), so the body **must start with `closes #<num>`** on the first line — GitHub auto-closes on merge. The PR *title* is `[#<num>] <issue title>` (sub-issue: `[#<epic>/#<num>] <issue title>`); that's set on `gh pr create`, not in the body.

## Skeleton

```md
closes #123

## Overview

{Epic} — PR2: {scope} `[additive]`.

{Problem, and this PR's scope — what it does vs. defers}.

## Architecture diagrams

{ /arch-diagrams output }

## Contents

### domain
- {artifact}

### infrastructure
- {artifact}

## Design decisions

- **{decision}** — {rationale}.

## Verification

- `<formatter>` / `<linter>` / `<test runner>` green (N tests).
```
