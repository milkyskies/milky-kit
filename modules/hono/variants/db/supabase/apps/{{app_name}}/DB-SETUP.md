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

### 3. Get the connection string

Project Settings → Database → Connection pooling. Copy the **Transaction pooler** URL (port 6543). It looks like:

```
postgres://postgres.<project-ref>:<password>@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres
```

### 4. Apply migrations to prod

```bash
# Temporarily point .env at prod, run drizzle-kit migrate, revert.
# OR: export DATABASE_URL inline so .env stays local-pointing:
DATABASE_URL="postgres://..." pnpm db:migrate
```

### 5. Wire up Cloudflare Hyperdrive

```bash
# Use the DIRECT (non-pooler) connection string for Hyperdrive — it does its own pooling.
# Direct URL is on the same Database settings page (port 5432, not 6543).
pnpm wrangler hyperdrive create {{project_name}}-db \
  --connection-string="postgres://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres"
```

It returns a Hyperdrive ID. Edit `wrangler.jsonc` and replace the `id` placeholder.

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
