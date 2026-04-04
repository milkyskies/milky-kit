---
name: rulify
description: >
  Cross-check modified code against each rule in .claude/rules/, detect violations, and auto-fix them. Use as a self-check before code review.
  TRIGGER when: the user wants to check rule compliance, asks for a self-review, or says "rulify".
  DO NOT TRIGGER when: the user is asking for a general code review unrelated to .claude/rules/.
argument-hint: "[PR number or focus area (optional)]"
---

Inspect whether modified code complies with the rules defined in `.claude/rules/`, and automatically fix clear violations.

## User-specified focus

$ARGUMENTS

## Processing Flow

### Step 1: Collect changed files and applicable rules

1. **Get changed files**: Retrieve using the appropriate method based on the argument:
   - **If a PR number is specified** (e.g., `#123`, `123`): Get via `gh pr diff {PR_number} --name-only`
   - **Otherwise (default)**: Get all diffs from the branch's origin + uncommitted changes
     - `git fetch origin`
     - `git merge-base HEAD origin/main` (try origin/master if origin/main doesn't exist)
     - `git diff --name-only {base_commit}...HEAD` + unstaged + staged + untracked
     - Deduplicate and merge all results
2. **List rule files**: List all `.claude/rules/*.md` files.
3. **Check CLAUDE.md**: If `CLAUDE.md` exists at the project root, read it as an additional rule source.

If there are no changed files, report "No changed files found" and stop.

### Step 2: Launch agents in parallel for each rule

Launch an Agent for each collected rule file. **Independent rules must be launched in parallel.**

Each agent's prompt must include:
- The rule file name and contents
- The list of changed files
- Instructions to read each changed file and inspect for violations
- Output format: `✅ No violations` or `❌ Violations found` with file, violation, severity (🔴 Clear / 🟡 Gray area), and fix

Agent settings:
- `subagent_type`: "general-purpose"
- `model`: "sonnet" (for speed)
- All rule inspection agents must be **launched in parallel in a single message**

### Step 3: Aggregate and display results

```
## Rulify Results

### Summary
- Rules inspected: N
- ✅ No violations: N
- ❌ Violations found: N

### Violation details
(Display results from rules with violations here)
```

### Step 4: Auto-fix

If 🔴 clear violations exist:
1. Review the fix details
2. Apply fixes using the Edit tool
3. Run formatters/tests/builds as needed

🟡 Gray area violations are reported only — no fixes applied.

### Step 5: Report fix results

```
## Rulify Complete

### Auto-fixed
- {file_path}: {fix summary}

### Needs review (gray area)
- {file_path}: {issue description}

### No fixes needed
All rules passed! No violations found.
```

## Important Rules

1. **Parallel execution**: Rule inspection agents must always be launched in parallel.
2. **Strict scoping**: Only inspect changed files.
3. **Avoid false positives**: Do not flag anything not explicitly stated in the rules.
4. **Auto-fix safety**: Only auto-fix 🔴 clear violations.
5. **Separation from formatters**: Leave formatting issues to formatters.
