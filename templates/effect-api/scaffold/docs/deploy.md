# Deploying with Dokploy

The API is one container (`bun src/main.ts`) serving REST at `/api` and MCP at
`/mcp`, plus a Postgres database. Dokploy builds and runs everything in Docker; you
mostly click in its UI. The container migrates the database on every start, so a
deploy is self-contained.

## ⚠️ Read first: there is no auth

`/mcp` and the mutating REST endpoints have **no authentication** out of the box.
The moment the app has a public domain, anyone with the URL can call them. Before
attaching a public domain, either keep it private (Tailscale / WireGuard / an SSH
tunnel `ssh -L 3000:localhost:3000 user@server`) or add an auth middleware that
checks `Authorization: Bearer <secret>` on every request.

## 1. Provision Postgres

Dokploy → **Create → Database → PostgreSQL** (use PostgreSQL 16+). Note the
database/user/password; Dokploy shows an **internal connection string** like
`postgresql://<user>:<pass>@<service-name>:5432/<db>` — the app uses this.

## 2. Create the Application

1. Dokploy → **Create → Application**, connect the GitHub repo.
2. **Build Type → `Dockerfile`**, path `./Dockerfile` (repo root).
3. **Environment variables**:
   ```
   DATABASE_URL=postgresql://<user>:<pass>@<pg-service>:5432/<db>
   PORT=3000
   LOG_FORMAT=json
   LOG_LEVEL=info
   ```
   (Add any provider keys your app reads, e.g. an AI provider key, as secrets.)
4. Point Dokploy's proxy at container port **3000**. Attach a public domain only
   after handling auth (see the warning).
5. Deploy.

## 3. Migrations run automatically

The container migrates on every start (`scripts/migrate.ts` via drizzle-orm's
Bun-native migrator) before the server boots:

- **Fresh DB**: the first deploy creates the whole schema.
- **Existing DB**: applied migrations are skipped (tracked in
  `__drizzle_migrations`); only new ones run.
- **New migration later**: commit the generated file under `drizzle/migrations/`;
  the next deploy applies it. A migration failure aborts the boot, so a bad
  migration fails the deploy instead of serving a half-migrated DB.

Generate migrations on your dev machine after a schema change
(`pnpm --filter <app> db:generate`) — that needs drizzle-kit, which is why it's a
dev-only step. Applying them is automatic.

Migrating data from an existing database? `pg_dump` it and pipe into the Dokploy
Postgres (over its exposed port, or `ssh user@server 'docker exec -i <pg-container>
psql ...'`).

## 4. Auto-deploy on push

- **GitHub App (easiest)**: connect Dokploy's GitHub App to the repo and enable
  **Auto Deploy** on the application (watch `main`). Dokploy wires the webhook.
- **Manual webhook**: copy the application's deploy **webhook URL** from Dokploy
  into the GitHub repo → **Settings → Webhooks** with the `push` event.

Then `git push` → Dokploy rebuilds → new container starts → migrates on boot →
serves.

## 5. Connecting an MCP client to the deployed server

Once reachable (and authed):
```bash
claude mcp add --transport http <name> https://<your-domain>/mcp
# with a token: ... --header "Authorization: Bearer <secret>"
```
