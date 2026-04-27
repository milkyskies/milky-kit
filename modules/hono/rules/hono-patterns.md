---
paths:
  - "apps/api/**/*.ts"
---

# Hono Patterns

## Layer layout

Clean-architecture DDD split. Each layer depends only on inner layers.

```
apps/api/src/
├── domain/               # pure types, no I/O
│   ├── models/           # Data.case + Option — fromRow, toApi
│   └── repositories/     # repository interfaces (types)
├── application/
│   └── use-case/         # orchestration, takes repo by parameter
├── infrastructure/
│   └── db/               # schema, drizzle client, repository impls
└── presentation/
    └── routes.ts         # Hono app — thin handlers, edge conversions
```

- `domain/` must not import from `infrastructure/`, `application/`, or `hono`.
- `application/` must not import from `infrastructure/` or `hono`.
- Only `presentation/` and `infrastructure/` know about Drizzle / D1 / Hono.

## Domain models

- Live in `apps/api/src/domain/models/`. Use `Data.case` + `Option` per `models.md`.
- Provide `fromRow(row)` for Drizzle row → domain, `toApi(model)` for domain → JSON response.
- Nullable DB columns become `Option.Option<T>`; consumers never see `null` in domain code.
- `Date` columns stay as `Date` in the model — Drizzle already parses them via the timestamp mode.

## Repositories

- Interface (type, not class) lives in `domain/repositories/<resource>-repository.ts`.
- Implementation lives in `infrastructure/db/<driver>-<resource>-repository.ts`.
- **Functional factory pattern** — no classes, no `this`, no `new`:

  ```typescript
  export const makeD1SnippetRepository = (d1: D1Database): SnippetRepository => {
    const db = drizzle(d1);
    return {
      findByCode: async (code) => { /* ... */ },
      create: async (input) => { /* ... */ },
      // ...
    };
  };
  ```

- Repository methods return `Promise<Option.Option<T>>` for "may not exist", `Promise<T>` for guaranteed results, `Promise<void>` for commands.
- Repo impls are where Drizzle row → domain conversion happens (`Snippet.fromRow(row)`).
- Never leak Drizzle types out of the repository. Domain layer must not know the table exists.

## Use cases

- Live in `application/use-case/<verb>-<resource>.ts`. One use case per file.
- Take the repository (or repositories) as the first parameter. Pure function shape:

  ```typescript
  export async function getSnippet(
    repo: SnippetRepository,
    code: string,
  ): Promise<Option.Option<Snippet>> { /* ... */ }
  ```

- No Hono imports. No request/response types. Input is a plain object; output is a domain value.
- Business rules live here (e.g. "return none if expired"), not in routes or repositories.

## Routes (presentation)

- `presentation/routes.ts` exports `export const app = new Hono<{ Bindings: Bindings }>()`.
- Handlers are thin: parse input → instantiate repo → call use case → convert domain → JSON.
- Instantiate the repository **per request** from `c.env` — Workers isolates are stateless.
- Convert `Option` → JSON null at the edge using `Option.match` / `Snippet.toApi`. Never return a raw domain value with `Option` fields to the wire.

  ```typescript
  app.get("/snippets/:code", async (c) => {
    const repo = makeD1SnippetRepository(c.env.DB);
    const maybe = await getSnippet(repo, c.req.param("code"));
    return Option.match(maybe, {
      onNone: () => c.json({ error: "Not found or expired" }, 404),
      onSome: (s) => c.json(Snippet.toApi(s)),
    });
  });
  ```

- Export a typed app handle for Hono RPC:

  ```typescript
  // apps/api/src/app.ts
  import { app } from "./presentation/routes";
  export type AppType = typeof app;
  export default app;
  ```

## Frontend consumption (Hono RPC)

- When a `web/` app lives in the same repo, prefer Hono's typed client over a generated OpenAPI client — types flow directly from the server file, no codegen step.

  ```typescript
  // apps/web/src/api.ts
  import { hc } from "hono/client";
  import type { AppType } from "../../api/src/app";
  export const api = hc<AppType>(import.meta.env.VITE_API_URL);
  ```

- If the API grows beyond a single repo consumer, promote the domain to `packages/domain` with Effect Schema. Don't preemptively extract.

## Drizzle schema

- Schema lives in `infrastructure/db/schema.ts`. Single source of truth for tables.
- Use `sqlite-core` for D1 / Workers, `pg-core` for Node / Postgres.
- Use `integer("created_at", { mode: "timestamp" })` so Drizzle parses to `Date` automatically.
- Migrations output to `drizzle/migrations/` via `drizzle.config.ts`.

## Workers specifics

- `wrangler.jsonc` declares D1 bindings; keep them named `DB` to match the `Bindings` type.
- No filesystem, no long-lived connections, no Node APIs unless `nodejs_compat` is enabled.
- Use `wrangler d1 execute <db> --local --file=drizzle/migrations/0000_*.sql` for local migration runs during dev, or wire a `db:migrate` task.
