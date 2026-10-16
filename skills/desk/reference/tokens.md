# Tokens

Read this before writing a brief or reusing a worker.

- Pass file paths in briefs, never file contents. The worker reads what it needs.
- Read a worker's summary, then its report, then its transcript, and stop when one answers the question.
- `/clear` a reused worker before an unrelated task.
- Never switch models or toggle MCP servers mid-run.
- Rules that load every turn stay small. Rules for review, landing, issues and cleanup live in reference files loaded when their moment comes.
