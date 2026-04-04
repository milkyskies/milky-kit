---
name: update-rule
description: >
  Create or update a rule in .claude/rules/ based on a pattern, decision, or convention just established in the conversation.
  TRIGGER when: the user establishes a new coding convention, architectural decision, tooling preference, or workflow rule.
  DO NOT TRIGGER when: the user is asking a question, requesting a code change unrelated to conventions, or the pattern is already captured.
argument-hint: [rule-name] or leave blank to infer from context
allowed-tools: Read, Write, Edit, Glob
---

# Update Rule: $ARGUMENTS

Look at the recent conversation to identify the pattern, convention, or decision that should be captured as a rule.

## Step 1 — Determine the rule file

If `$ARGUMENTS` is provided, use it as the filename: `.claude/rules/$ARGUMENTS.md`.

If no arguments, infer a short kebab-case filename from the topic (e.g. `error-handling`, `api-patterns`, `testing`).

Check if the file already exists with Glob on `.claude/rules/`.

## Step 2 — Draft the rule content

Extract the key decisions from the conversation:
- What should always be done
- What should never be done
- Which files/layers/contexts it applies to
- Any concrete examples or code snippets worth including

Keep it concise and prescriptive. Rules are instructions for Claude, not documentation for humans.

If the rule file already exists, read it first, then update or extend it — don't duplicate existing content.

## Step 3 — Write the file

If creating a new file, include a YAML frontmatter `paths:` scope only if the rule is specific to certain files. Omit frontmatter if it applies globally.

Write or edit the file.

## Step 4 — Confirm

Tell the user the file path and briefly summarise what was captured.
