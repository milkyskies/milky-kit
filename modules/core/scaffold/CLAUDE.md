# Agent Instructions

All rules live in `.claude/rules/` and are loaded automatically. Read them.

## Non-Interactive Shell Commands

**ALWAYS use non-interactive flags** to avoid hanging on prompts:

```bash
cp -f source dest
mv -f source dest
rm -f file
rm -rf directory
```

## Setup

After scaffolding, run these once to finish setup:

```bash
# Create GitHub repo
gh repo create {{project_name}} --source . --push

# Install glb (ghlobes) — task tracking via GitHub Issues + Projects
cargo install --git https://github.com/milkyskies/ghlobes.git
glb init                        # detects repo + project, writes .ghlobes.toml
```

See `.claude/rules/workflow.md` for daily glb usage.

## Key mise Commands

```bash
mise run dev                    # Full stack in tmux
mise run dev:api                # API server only
mise run dev:client             # Client app only
mise run check                  # Lint + test everything
mise run fmt                    # Format everything
mise run db:migrate             # Run database migrations
mise run db:reset               # Reset database
mise run api:generate           # Regenerate OpenAPI client
mise run worktree:setup <n> <branch>   # Create worktree for issue
mise run worktree:cleanup <n>          # Remove worktree
```
