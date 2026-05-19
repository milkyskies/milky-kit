# Configuration & Environment

- All configuration via environment variables
- `.env` is git-ignored, `.env.example` is committed with placeholders
- Rule: deployment environment (dev/staging/prod) -> `.env`, per-user config -> database
- Never put secrets in committed files, never default secrets in code

## Adding a new env var

- Add the placeholder + a one-line "what is this" comment to the committed `.env.example` (in the workspace that reads it). This is the contract — it's what propagates to teammates and to new worktrees.
- Add the real dev value to your local `.env` so your code works.
- You don't need to update other worktrees' `.env` files — they're per-worktree and isolated. New worktrees pick it up via the worktree-setup task copying from the main repo's `.env`.
- If the var has a non-`.env` runtime source (Cloudflare Workers `wrangler.jsonc` `vars`, Vercel project settings, Fly secrets, etc.), mirror it there too and reference that source from the `.env.example` comment.
- `.env.example` must list **every** key the runtime reads. Mark optional keys with `# optional —` in the comment instead of omitting them.
