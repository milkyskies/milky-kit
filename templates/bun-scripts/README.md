# templates/bun-scripts

Personal-scale Bun + TypeScript project for one-off scripts. No build step, no workspace, no monorepo — `bun run scripts/foo.ts` and you're running.

Made for the use case where you need a script with type checking and a sane lint pass but don't want the overhead of a full app template.

## Capabilities

| Capability | Status | Source |
|---|:---:|---|
| Run TS directly | ✓ | Bun (no build) |
| Top-level await | ✓ | ES modules everywhere |
| Bun-native APIs | ✓ | `Bun.file`, `Bun.spawn`, `Bun.sql`, etc. |
| Tests | ✓ | `bun test` (Jest-compatible) |
| Lint + format | ✓ | `@biomejs/biome` extending `@milkyskies/biome-config` |
| Typecheck | ✓ | `tsc --noEmit` |
| Workspace / monorepo | ✗ | by design — use a real template if you need this |
| HTTP server | ✗ | use `effect-api` or `hono-api` |

## Stack

- **Runtime**: Bun
- **Language**: TypeScript with strict + `noUncheckedIndexedAccess`
- **Test**: `bun test` (native, Jest-compatible)
- **Lint**: `@biomejs/biome` extending `@milkyskies/biome-config`

## Directory layout

```
apps/{{app_name}}/
├── src/
│   ├── health.test.ts    Dummy test so `bun test` is green from day one
│   └── <your scripts>.ts Whatever scripts you need
├── biome.json            extends @milkyskies/biome-config
├── package.json
└── tsconfig.json
```

There's no `apps/<app>/dist/` or build output — Bun runs `.ts` directly.

## First-run

```bash
bun install
bun run scripts/<your-script>.ts
```

Run the test runner:

```bash
bun test
```

Run quality gates:

```bash
bun run lint      # biome check .
bun run typecheck # tsc --noEmit
bun run test      # bun test
bun run check     # all three
```

## When to use this template

- One-off automation, data manipulation, file processing, API scraping, etc.
- A script that needs typed parameters but doesn't justify a workspace setup.
- A starting point that can grow — if it outgrows scripts, retrofit to `effect-api` or `hono-api` later.

## When NOT to use

- You need an HTTP server → `hono-api` or `effect-api`
- You need a frontend → `react-spa`
- You need a Rust runtime → `axum-api`
- You have multiple apps that share code → any of the above (they support workspaces)
