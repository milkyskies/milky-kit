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
│   ├── models/           # Data.case + Option — pure interface, no row/DTO knowledge
│   └── repositories/     # repository interfaces (types)
├── application/
│   └── use-case/         # orchestration, takes repo by parameter
├── infrastructure/
│   └── db/               # schema, drizzle client, repository impls
└── presentation/
    ├── app.ts            # Hono app composition — applies middleware, mounts routers
    ├── middleware/       # cross-cutting wiring — repositories.ts injects repos onto context.var
    ├── routes/           # one file per resource — <resource>-routes.ts
    └── dto/              # one file per resource — <resource>-dto.ts (types + to/from helpers)
```

- `domain/` must not import from `infrastructure/`, `application/`, or `hono`.
- `application/` must not import from `infrastructure/` or `hono`.
- Only `presentation/` and `infrastructure/` know about Drizzle / D1 / Hono.

## Domain models

- Live in `apps/api/src/domain/models/`. Use `Data.case` + `Option` per `models.md`.
- **Pure** — no row shape, no DTO type, no converters. The model file imports nothing from `infrastructure/` or `presentation/`.
- Nullable DB columns become `Option.Option<T>` in the model; consumers never see `null` in domain code.
- `Date` columns stay as `Date` in the model — Drizzle already parses them via the timestamp mode.
- **Row → domain** conversion is the repository's job (see below). **Domain → DTO** is presentation's (see `presentation/dto/`).

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
- **Row → domain conversion is private to the repo.** Use Drizzle's inferred row type and a local `fromRow` helper:

  ```typescript
  type SnippetRow = typeof snippetsTable.$inferSelect;

  const fromRow = (row: SnippetRow): Snippet =>
    Snippet.make({
      id: row.id,
      code: row.code,
      expiresAt: Option.fromNullable(row.expiresAt),
      // ...
    });

  export const makeD1SnippetRepository = (env: Bindings): SnippetRepository => {
    const db = drizzle(env.DB);
    return {
      findByCode: async (code) => {
        const row = await db.select()...;
        return row ? Option.some(fromRow(row)) : Option.none();
      },
      // ...
    };
  };
  ```

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

- One router file per resource: `presentation/routes/<resource>-routes.ts`. Each exports a Hono router (e.g. `postRoutes`).
- `presentation/app.ts` composes them: `new Hono<{ Bindings; Variables }>().use("*", repositoriesMiddleware).route("/", postRoutes).route("/", commentRoutes)`. Chain calls so Hono RPC types flow through.
- Handlers are thin: parse input → call use case with `context.var.<resource>Repository` → convert domain → JSON. **Routes never call `makePostRepository` directly** — that's the middleware's job. No inline DTO massaging either; defer to helpers in `presentation/dto/`.
- Use full parameter names (`context`, not `c`). Avoid abbreviations even when the framework convention is shorter.
- Convert `Option` → JSON null at the edge using `Option.match` / `toPostDto`. Never return a raw domain value with `Option` fields to the wire.

  ```typescript
  postRoutes.get("/snippets/:code", async (context) => {
    const maybe = await getSnippet(
      context.var.snippetRepository,
      context.req.param("code"),
    );
    return Option.match(maybe, {
      onNone: () => context.json({ error: "Not found or expired" }, 404),
      onSome: (snippet) => context.json(toSnippetDto(snippet)),
    });
  });
  ```

- Export a typed app handle for Hono RPC:

  ```typescript
  // apps/api/src/app.ts
  import { app } from "./presentation/app";
  export type AppType = typeof app;
  export default app;
  ```

## Middleware (presentation)

- Per-request wiring lives in `presentation/middleware/`. The standing piece is `repositories.ts`, which builds repository instances from `context.env` and exposes them via `context.var`.
- Workers isolates are stateless, so repos must be built per request — middleware is the right hook for that.
- Each new resource adds one line to the middleware (`context.set("postRepository", makePostRepository(context.env))`) and an entry in `RepositoryVariables`.
- Routes type their Hono generic with `{ Bindings; Variables: RepositoryVariables }` so `context.var.postRepository` is typed.

## DTOs (presentation)

- One file per resource: `presentation/dto/<resource>-dto.ts`.
- Owns the wire-shape types (`PostDto`, `CreatePostDto`, `UpdatePostDto`) and the conversion helpers:
  - `toPostDto(post: Post): PostDto` — domain → wire (Option/Date → null/string).
  - `fromCreatePostDto(dto: CreatePostDto): CreatePostInput` — wire → use case input.
  - `fromUpdatePostDto(dto: UpdatePostDto): PostPatch`.
- For the OpenAPI variant, DTOs are Zod schemas (`PostDtoSchema`, etc.) and types are `z.infer<typeof Schema>`.
- Routes never construct `Option`/`Date` from request bodies inline — always go through a `from*Dto` helper.

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
