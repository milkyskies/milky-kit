# DB setup — Neon (Postgres)

Managed serverless Postgres. HTTP-based driver works directly on Workers — no Hyperdrive needed.

## Production setup (set up first; then point dev at a branch)

### 1. Create the Neon project

1. Go to https://console.neon.tech → "Create project"
2. Pick a region (no Tokyo on free tier — Singapore is closest in Asia)
3. Save the auto-created connection string

### 2. Create a `dev` branch (recommended)

In the Neon dashboard → Branches → "Create branch" → name `dev`, branch from `production`. Local dev hits this branch instead of prod.

### 3. Set local env

```bash
cp .env.example .env
cp .dev.vars.example .dev.vars
# Edit both to use your dev branch URL
```

`.env` is for drizzle-kit (no quotes); `.dev.vars` is for wrangler (TOML, with quotes).

### 4. Generate + apply migrations

```bash
pnpm db:generate
pnpm db:migrate
```

### 5. Set the production secret

```bash
pnpm wrangler secret put DATABASE_URL
# paste the production branch URL
```

### 6. Deploy

```bash
pnpm deploy
```

## Local development

```bash
pnpm dev
# wrangler reads .dev.vars; the @neondatabase/serverless driver hits Neon over HTTP
```

No Docker needed — local dev hits real Neon. Branching makes this safe.

## When Neon doesn't fit

- You're in Japan and need Tokyo region (Neon's free tier doesn't include Tokyo) → use `supabase` variant
- You want SQLite simplicity → use `d1` variant
- You don't want any external DB provider → use `supabase` variant + Docker locally + self-host prod
