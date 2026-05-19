# DB setup — Cloudflare D1 (SQLite)

D1 is Cloudflare's built-in SQLite, bound directly to your Worker. No separate provider, no connection strings.

## Local development

`wrangler dev` automatically uses a local SQLite file under `.wrangler/state/v3/d1/`.

```bash
# 1. Generate the initial migration
pnpm db:generate

# 2. Apply to the local D1
pnpm db:migrate:local

# 3. Run the API
pnpm dev
```

Local data persists between runs. Wipe it with `rm -rf .wrangler/state/v3/d1`.

## Production setup

### 1. Create the D1 database on Cloudflare

```bash
pnpm wrangler d1 create {{project_name}}
# Copy the database_id from the output
```

### 2. Paste it into `wrangler.jsonc`

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "{{project_name}}",
    "database_id": "<paste-here>",
    "migrations_dir": "drizzle/migrations"
  }
]
```

### 3. Apply migrations to prod

```bash
pnpm db:migrate:remote
```

### 4. Deploy

```bash
pnpm deploy
```

## Limits to know

| | D1 free tier | D1 paid |
|---|---|---|
| Storage | 5 GB | up to 50 GB / DB |
| Reads | 5M / day | 25B / mo, then $0.001 / 1K |
| Writes | 100K / day | 50M / mo, then $1 / 1M |
| Max DB size | 10 GB | 10 GB |

D1 is single-writer with replicated reads at the edge. Strongly consistent within a region; eventually consistent across regions (~ms).

## When to switch off D1

- You need PostGIS / vector / full-text search beyond SQLite FTS5
- Heavy concurrent writes (>100/sec sustained)
- Schema needs jsonb arrays, ranges, etc.

If so, see the `neon` or `supabase` variants for Postgres.
