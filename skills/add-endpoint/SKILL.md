---
name: add-endpoint
description: Add a new API endpoint to the backend, regenerate the OpenAPI spec, regenerate the frontend TypeScript client, and wire up the page. Works for any endpoint.
argument-hint: <description> (e.g. "GET /api/tasks", "POST /api/messages", "users resource CRUD")
---

# Add Endpoint: $ARGUMENTS

Add **$ARGUMENTS** end-to-end: handler -> route registration -> OpenAPI -> frontend codegen -> page.

## Step 1 — Read existing patterns first

Before writing anything, read these to understand the conventions:
- Existing DTOs / request/response types
- Route registration file
- A similar existing handler
- Example repository trait and implementation

## Step 2 — Add DTOs / request-response types

All request/response types go in the presentation layer.

**Derive rules:**
- Response types: `Serialize, ToSchema`
- Request body types: `Deserialize, ToSchema`

## Step 3 — Add repository trait

**All database access MUST go through repository traits** defined in the domain layer.

## Step 4 — Implement the repository

Implement using the project's ORM (check `.claude/rules/` for database conventions — SeaORM, sqlx, etc.).

## Step 5 — Write the handler

Handlers call repository methods — never raw SQL. Keep handlers thin.

## Step 6 — Register the route

Add to the route registration file.

## Step 7 — Register in OpenAPI

Add paths and schemas to the OpenAPI configuration.

## Step 8 — Compile check

```bash
cargo check -p api
```

## Step 9 — Regenerate frontend client

Update the OpenAPI spec and regenerate the TypeScript client:

```bash
cd <app-dir> && pnpm api:generate
```

Commit the updated `openapi.json`.

## Step 10 — Create the frontend page (if needed)

Follow the project's frontend conventions (check `.claude/rules/` for component patterns, routing, and UI library).

## Step 11 — Final check

```bash
pnpm routes:generate
pnpm typecheck
```

## Checklist

- [ ] Existing patterns read
- [ ] DTOs added
- [ ] Repository trait defined
- [ ] Repository implemented
- [ ] Handler written (no raw SQL)
- [ ] Route registered
- [ ] OpenAPI updated
- [ ] `cargo check -p api` passes
- [ ] Frontend client regenerated
- [ ] Page created (if needed)
- [ ] Final typecheck passes
