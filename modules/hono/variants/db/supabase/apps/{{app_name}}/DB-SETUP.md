# DB setup — Supabase + Hyperdrive (Postgres)

Postgres backend with PostGIS available for geospatial work. Local dev runs against Docker; prod runs against Supabase Tokyo, fronted by Cloudflare Hyperdrive.

## Local development

```bash
# 1. From repo root, start Postgres + PostGIS
docker compose up -d
docker compose ps   # confirm db is healthy

# 2. (One-time) enable PostGIS in the local DB
docker compose exec db psql -U postgres -d {{project_name}} -c "CREATE EXTENSION IF NOT EXISTS postgis;"

# 3. Copy env files
cp .env.example .env

# 4. Generate + apply migrations to local DB
pnpm db:generate
pnpm db:migrate

# 5. Run the API (Hyperdrive uses localConnectionString from wrangler.jsonc)
pnpm dev
```

`docker compose down` to stop. Data persists in the `dbdata` volume; `docker compose down -v` wipes it.

## Production setup (Supabase)

### 1. Create the Supabase project

1. Go to https://supabase.com → "New project"
2. Region: **Tokyo (ap-northeast-1)**
3. Save the database password somewhere safe
4. Wait for provisioning (~1 min)

### 2. Enable PostGIS

In the Supabase dashboard → SQL Editor → run:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

### 3. Two connection strings — know which goes where

Supabase exposes the same database via two endpoints. Use the right one for the right thing or you'll spend hours debugging hung requests.

**Project Settings → Database** (or the Database tab) shows both:

| URL | Port | Username | Use for |
|---|---|---|---|
| **Direct** — `db.<ref>.supabase.co` | `5432` | `postgres` | **Hyperdrive ONLY** (it runs its own transaction-mode pool on top — Cloudflare's docs require the direct host). |
| **Supavisor pooler** — `aws-X-<region>.pooler.supabase.com` | `5432` (session) or `6543` (transaction) | `postgres.<ref>` | Migrations from your laptop (drizzle-kit). Long-lived connections from Node servers. NEVER for Hyperdrive. |

**Why:** Hyperdrive is itself a transaction-mode pool. Stacking it on Supavisor's pool causes connections to silently hang during establishment — the Worker logs show alternating `Network connection lost` and `Worker's code had hung after we tried other drivers`. There's no clean error; requests just freeze.

### 4. Apply migrations to prod

Use the **Supavisor pooler** URL here (drizzle-kit runs from your laptop, not from a Worker, so the pooler is fine and cheaper than direct):

```bash
DATABASE_URL="postgres://postgres.<ref>:<password>@aws-X-<region>.pooler.supabase.com:6543/postgres" \
  pnpm db:migrate
```

(Or temporarily edit `.env`, run `pnpm db:migrate`, revert.)

### 5. Wire up Cloudflare Hyperdrive

Use the **direct** URL — port 5432, user `postgres` (no `.<ref>` suffix):

```bash
pnpm wrangler hyperdrive create {{project_name}}-db \
  --connection-string="postgres://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres"
```

It returns a Hyperdrive ID. Edit `wrangler.jsonc` and replace the `id` placeholder.

**Heads-up if you're updating an existing Hyperdrive that was previously pointed at the pooler:**

```bash
pnpm wrangler hyperdrive update <existing-id> \
  --connection-string="postgres://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres"
```

Or recreate (`hyperdrive create` again) and bump `wrangler.jsonc`'s `id` to the new one. The symptom of an existing-pool-on-pool config is the same hang.

### 6. Deploy the Worker

```bash
pnpm deploy
```

The Worker reads from `c.env.HYPERDRIVE.connectionString` automatically — no other config.

## Working with PostGIS in Drizzle

PostGIS columns aren't first-class in Drizzle. Use `customType` or `sql` template literals:

```ts
import { customType, pgTable, text } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const point = customType<{ data: string; driverData: string }>({
	dataType: () => "geometry(Point, 4326)",
});

export const places = pgTable("places", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	location: point("location").notNull(),
});

// Insert with WKT
await db.insert(places).values({
	id: "abc",
	name: "Tokyo Station",
	location: "POINT(139.7670 35.6812)",
});

// Distance query
await db.execute(sql`
	SELECT id, name,
		ST_Distance(location::geography, ST_MakePoint(${lng}, ${lat})::geography) AS meters
	FROM places
	ORDER BY meters ASC
	LIMIT 20
`);
```

## Troubleshooting

| Problem | Fix |
|---|---|
| `connection refused` locally | `docker compose ps` — db running? `docker compose logs db` for errors |
| `extension postgis does not exist` | Step 2 above (local) or Supabase SQL editor (prod) |
| Hyperdrive returns stale connection | `wrangler hyperdrive update <id> --connection-string="..."` after rotating password |
| Slow first query in prod | Hyperdrive is warming a connection; subsequent queries are fast |
| Authed routes hang forever / `Network connection lost` / `Worker's code had hung after we tried other drivers` | Hyperdrive is pointed at Supabase's **Supavisor pooler** instead of the direct host. Stacking transaction pools breaks. Recreate Hyperdrive against `db.<ref>.supabase.co:5432` (user `postgres`) — see step 5. |
