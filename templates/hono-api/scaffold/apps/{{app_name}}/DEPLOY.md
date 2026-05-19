# Deploying the API

Step-by-step from a fresh clone to a deployed Worker. Variant-specific details (Neon URL, Hyperdrive id, KV namespaces, Firebase) are linked from the relevant section.

## 1. Authenticate wrangler

```bash
pnpm wrangler login
pnpm wrangler whoami
```

`whoami` should print your Cloudflare account email + the account id you'll deploy under. If you have multiple accounts, set `CLOUDFLARE_ACCOUNT_ID` in `.dev.vars` (and as a CI secret) to lock the right one.

## 2. Database setup

Pick the file matching your `db` variant:

- **`db = "d1"`** → see [`DB-SETUP.md`](./DB-SETUP.md). `wrangler d1 create`, paste id into `wrangler.jsonc`, `db:migrate:remote`.
- **`db = "neon"`** → see `DB-SETUP.md`. Sign up Neon, paste connection string into `.env` + `.dev.vars`, run `db:migrate`.
- **`db = "supabase"`** → see `DB-SETUP.md`. Create Supabase project (Tokyo region), enable PostGIS, `wrangler hyperdrive create`, paste id into `wrangler.jsonc`.

## 3. Auth setup (if `auth = "firebase"`)

See [`SETUP-AUTH.md`](./SETUP-AUTH.md). Create Firebase project, enable a sign-in provider, fill in `FIREBASE_PROJECT_ID`, run `wrangler kv namespace create JWK_CACHE` and `USER_CACHE`, paste ids into `wrangler.jsonc`, wire `authMiddleware` to the routes that need it.

## 4. Environment variables

Two places, two formats:

| File | Read by | Format | Committed? |
|---|---|---|---|
| `wrangler.jsonc` `vars` | wrangler at deploy time (prod default) | JSONC | ✓ — public values only |
| `.dev.vars` | `wrangler dev` (local override) | dotenv-style with optional quotes | ✗ (gitignored) |
| `.env` | `drizzle-kit` (migrations from your laptop) | dotenv-style, no quotes | ✗ (gitignored) |
| Cloudflare secrets | wrangler at deploy time, encrypted on CF | `wrangler secret put NAME` | n/a — server-side only |

**Public vs secret rule of thumb:**

- **Public** (`wrangler.jsonc` `vars`): `FIREBASE_PROJECT_ID`, `CORS_ORIGINS`, anything end-users could see anyway.
- **Secret** (`wrangler secret put`): `DATABASE_URL`, API keys, signing secrets. Never commit, never put in `vars`.

For local dev, `.dev.vars` overrides BOTH `vars` and secrets. Useful for pointing at a dev DB / dev Firebase project without touching prod config.

## 5. CORS origins

Already wired via `CORS_ORIGINS` env var.

- Prod (`wrangler.jsonc`): comma-separated production origins (`https://your-app.com`).
- Local (`.dev.vars.example` → `.dev.vars`): `http://localhost:5173,capacitor://localhost`.

Add native iOS/Android schemes (`capacitor://localhost`, `ionic://localhost`) for mobile apps.

## 6. Deploy

```bash
cd apps/{{app_name}}
pnpm deploy
```

This runs `wrangler deploy --minify`. First deploy creates the Worker; subsequent deploys update it.

## 7. Custom domain

By default the Worker is at `<name>.<account>.workers.dev`. To attach your own domain, edit `wrangler.jsonc`:

```jsonc
{
  // ... existing config
  "routes": [
    { "pattern": "api.your-app.com/*", "zone_name": "your-app.com" }
  ]
}
```

The DNS zone (`your-app.com`) must already be on Cloudflare. Wrangler creates a Worker route during deploy.

For finer control (custom certs, edge caching), use the Cloudflare dashboard → Workers & Pages → your Worker → Settings → Triggers.

## 8. Observability

```bash
# Stream live logs (filter by status, search, etc. — see flags)
pnpm wrangler tail

# Or in the Cloudflare dashboard:
# Workers & Pages → <your worker> → Logs (default observability is enabled in wrangler.jsonc)
```

`wrangler.jsonc` ships with `observability.enabled: true` and `head_sampling_rate: 1` so 100% of requests are sampled. Reduce the rate if you hit Workers Logs cost limits at scale.

## 9. Subsequent deploys

After the first deploy:

```bash
pnpm deploy                     # ship code
pnpm db:generate && pnpm db:migrate    # apply schema changes (Postgres variants)
pnpm db:migrate:remote          # apply schema changes (D1 variant)
pnpm wrangler secret put <NAME> # rotate a secret
```

CI runs `pnpm install --frozen-lockfile` + lint + typecheck + (separately) OSV-Scanner against `pnpm-lock.yaml`. See `.github/workflows/security.yml` for the security-scan workflow.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `Unauthorized` from `wrangler whoami` | Run `wrangler login` again |
| `binding DB / HYPERDRIVE not found at runtime` | `wrangler.jsonc` placeholder id wasn't replaced |
| `DATABASE_URL is not defined` (drizzle-kit migrate) | `.env` not created — `cp .env.example .env` |
| 401 from API on a route that should be public | A middleware was applied to `*` instead of a path-prefixed match |
| CORS preflight fails | Check `CORS_ORIGINS` includes the exact origin (scheme + port) the browser sends |
| Hyperdrive cold-start slow | First request after long idle reconnects the pool — subsequent requests are fast |
