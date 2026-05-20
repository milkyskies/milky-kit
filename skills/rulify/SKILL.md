---
name: rulify
description: >
  Diff-scoped check — inspect the lines you just added/modified (since origin/main, or a specific PR) against each rule in .claude/rules/, surface violations, and propose fixes. Pre-PR self-check; called by /ship.
  TRIGGER when: the user wants to check rule compliance, asks for a self-review, or says "rulify".
  DO NOT TRIGGER when: the user is asking for a general code review unrelated to .claude/rules/, or wants a whole-repo drift sweep (use /realign for that).
argument-hint: "[PR number or focus area (optional)]"
---

**Designed for**: tight feedback loop on a feature branch — what did I just break? Diff-scoped (only `+` lines since `origin/main`), runs N parallel haiku agents (one per applicable rule). Fast. For a whole-repo drift sweep against the kit's current rules, use `/realign` instead.

Inspect whether modified code complies with the rules defined in `.claude/rules/`, and surface violations with proposed fixes.

## User-specified focus

$ARGUMENTS

## Processing Flow

### Step 1: Collect changed files

1. **Get changed files and the diff**:
   - **If a PR number is specified** (e.g., `#123`, `123`):
     - Files: `gh pr diff {PR_number} --name-only`
     - Diff: `gh pr diff {PR_number}`
   - **Otherwise (default)**:
     - `git fetch origin`
     - `git merge-base HEAD origin/main` (try origin/master if origin/main doesn't exist)
     - Files: `git diff --name-only {base}...HEAD` + unstaged + staged + untracked (deduplicated)
     - Diff: `git diff {base}...HEAD` + `git diff` (unstaged) + `git diff --cached` (staged)
     - For untracked files, read their contents
2. **Store the combined diff** — this will be passed to agents inline so they don't need to read files themselves.

If there are no changed files, report "No changed files found" and stop.

### Step 2: Filter rules by scope

1. **List rule files**: List all `.claude/rules/*.md` files.
2. **Read each rule file's frontmatter** — check for a `paths:` field.
3. **Filter**: For each rule, check if any changed file matches the rule's `paths:` glob patterns.
   - Rules **without** a `paths:` field apply to all files — always include.
   - Rules **with** a `paths:` field are skipped if no changed file matches any of their patterns.
4. **Check CLAUDE.md**: If `CLAUDE.md` exists, read it — its content will be appended as context to all agents.

Report how many rules were filtered out (e.g., "Skipped 3/8 rules (no matching files)").

### Step 3: Launch agents for applicable rules

Launch an Agent for each applicable rule. **All agents must be launched in parallel in a single message.**

Each agent's prompt must include:

```
Inspect the following diff for violations against this rule. Do NOT use any tools to read files — all content is provided below.

## Rule
Rule name: {rule_file_name}

{Full rule file contents}

## Changed files
{List of changed file paths}

## Diff
```diff
{The combined diff from step 1}
```

## Additional context from CLAUDE.md (if applicable)
{Relevant sections from CLAUDE.md, or omit if none}

## Instructions

1. Read the rule carefully
2. Scan the diff for violations — focus only on added/modified lines (lines starting with +)
3. If the rule has a `paths` scope, skip files outside that scope
4. Report results in the format below

## Output format

### If no violations
✅ {rule_name}: No violations

### If violations found
❌ {rule_name}: Violations found

For each violation:
- **File**: target_file_path:line_number
- **Violation**: What violates the rule
- **Severity**: 🔴 Clear violation / 🟡 Gray area
- **Fix**: Specific fix description

## Constraints

- Do NOT flag anything not explicitly stated in the rule
- Do NOT report "nice to have" improvements
- Do NOT flag unchanged code (context lines starting with space)
- Only report items that clearly violate the rule
- Do NOT use any tools — all content is provided inline
```

Agent settings:
- `subagent_type`: "general-purpose"
- `model`: "haiku"
- All agents launched **in parallel in a single message**

### Step 4: Aggregate and display results

```
## Rulify Results

### Summary
- Rules checked: N (M skipped — no matching files)
- ✅ No violations: N
- ❌ Violations found: N

### Violation details
(Display results from rules with violations here)
```

### Step 5: Propose fixes (don't auto-apply)

For each 🔴 clear violation, propose the fix and ask the user to accept or skip via `AskUserQuestion`. **Don't auto-apply** — even clear violations get one round-trip of user confirmation. Surfacing the violation lets the user choose whether to apply now or defer; the user is faster than the wrong fix. (See `modules/core/rules/general.md`'s "be sunao" rule.)

When the user accepts a fix:
1. Apply via the `Edit` tool, one file at a time.
2. Run typecheck after each substantive change. If broken, surface the error and ask before continuing.

🟡 Gray-area violations are reported only — no fix proposed.

### Step 6: Report results

```
## Rulify Complete

### Applied (with user consent)
- {file_path}: {fix summary}

### Skipped (user declined or gray area)
- {file_path}: {issue description}

### No violations
All rules passed!
```

## Important Rules

1. **Pass diff inline**: The orchestrator reads files once and passes the diff to agents. Agents do NOT read files themselves.
2. **Pre-filter by paths scope**: Skip rules that can't apply to the changed files. Don't waste tokens on irrelevant rules.
3. **Use haiku for agents**: Agents only analyze provided content — no tools needed, haiku is sufficient.
4. **Parallel execution**: All applicable rule agents must be launched in parallel.
5. **Strict scoping**: Only inspect changed lines (+ lines in the diff).
6. **Avoid false positives**: Do not flag anything not explicitly stated in the rules.
7. **Ask before applying**: Even 🔴 clear violations get proposed for user confirmation via `AskUserQuestion`. Be sunao — surface the violation, let the user decide. See `modules/core/rules/general.md`.
8. **Separation from formatters**: Leave formatting issues to formatters.
