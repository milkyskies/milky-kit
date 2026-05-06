# Frontend Directory Structure

```
src/
├── app/                       Framework shell
│   └── routes/                TanStack Router file-based routes
├── features/                  UI by domain
│   ├── shared/                Reusable across features
│   │   ├── components/        Shared components (incl. wrappers around UI library parts)
│   │   ├── ui/                Thin re-exports of UI library (only when library expects pre-wrapped components — e.g. shadcn/ui)
│   │   ├── icons/             Wrapped / branded icons (one file each, no barrel)
│   │   └── providers/         App-wide providers
│   └── {feature-name}/        Feature-scoped code
│       ├── components/        Feature components
│       ├── use-{hook}.ts      Feature hooks (e.g. use-auth.ts)
│       └── ...                Anything else feature-internal
├── services/                  External integrations (HTTP, SDK init, etc.)
│   ├── api/                   API client + per-resource layers
│   │   ├── client.ts          Configured API client (e.g. hc<AppType>(baseUrl))
│   │   └── {resource}/        Service layers per resource (query options, mutation hooks, keys)
│   └── {service-name}/        Other SDK-backed services (firebase, mapbox, posthog, etc.)
├── lib/                       Generic utilities
│   └── query/                 TanStack Query helpers (createQueryOptions, createMutationHook, etc.)
├── models/                    Shared domain types
├── config/                    Environment variables + app config
└── assets/                    Static assets (CSS, images, etc.)
```

## Dependency rules

- `app/routes` → `features`, `services`, `lib`, `models`
- `features` → `services`, `lib`, `models`
- `features/shared` → nothing from other features (sibling features never import shared from each other's namespace; they share via `features/shared/`)
- `services` → `lib`, `models`
- `lib` → nothing (third-party only)
- `models` → nothing (or DTO types from a workspace API package, e.g. `@<project>/api/client`)

## Notes

- **No `_generated/` directory** when using Hono RPC (the typed client comes from `@<project>/api/client` directly, no codegen). Add one only if you switch to OpenAPI + orval.
- **Feature directories aren't required to have `components/`** — flat hooks (`use-auth.ts`) or use-case files live directly under `features/<name>/`. Use `components/` only when a feature has multiple components.
- **`features/shared/ui/` is often empty** — most UI libraries (Base UI, HeroUI) ship parts you compose directly in `shared/components/` rather than re-exporting individual primitives.
