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
# Create GitHub repo + set up task tracking
gh repo create {{project_name}} --source . --push
glb init                        # Creates .ghlobes.toml + adds agent instructions
cargo install ghlobes           # If not already installed
```

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
