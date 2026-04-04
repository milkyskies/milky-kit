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

## Task Tracking with glb

Use `glb` (ghlobes) for issue tracking via GitHub Issues + Projects.

| Command | What it does |
|---|---|
| `glb ready` | Show issues ready to work |
| `glb list` | List all open issues |
| `glb show <num>` | Show issue details |
| `glb update <num> --claim` | Claim an issue |
| `glb close <num>` | Close an issue |
| `glb create --title "..." --priority P2 --status Todo --points 3` | Create an issue |

## Key mise Commands

```bash
mise run dev                    # Full stack in tmux
mise run dev:api                # API server only
mise run dev:client             # Client app only
mise run check                  # Lint + test everything
mise run fmt                    # Format everything
mise run db:migrate             # Run database migrations
mise run db:reset               # Reset database
mise run worktree:setup <n> <branch>   # Create worktree for issue
mise run worktree:cleanup <n>          # Remove worktree
```
