# templates/react-spa

React SPA with TanStack Router (file-based routing + loaders) + TanStack Query (suspense-first data fetching) on Vite. Tailwind CSS v4. Biome for lint + format. Optional Firebase auth + mobile-shell variants.

Suspense-first means: components call `useSuspenseQuery`, never `useQuery` + `isLoading`. Loading state belongs to a `<Suspense>` boundary up the tree, not inside each component.

## Capabilities

| Capability | Status | Source |
|---|:---:|---|
| File-based routing | ✓ | TanStack Router |
| Loader-driven data | ✓ | TanStack Query `queryOptions` + Router `loader`s |
| Suspense queries | ✓ | `useSuspenseQuery` everywhere |
| Optimistic mutations | ✓ | `createOptimisticMutationHook` + `optimisticHelper` factories |
| Tailwind CSS v4 | ✓ | `@tailwindcss/vite` plugin |
| Hono RPC client | ✓ | typed against `apps/api`'s `AppType` |
| Firebase auth | ✓ (variant) | `auth: firebase` — `AuthState` as `Data.taggedEnum` |
| Mobile (Capacitor) | ✓ (variant) | `mobile: capacitor` |
| Mobile (Tauri 2) | ✓ (variant) | `mobile: tauri` |
| UI: shadcn / heroui / base-ui | ✓ (variants) | each ships its own setup |
| SSR / SSG | ✗ | this is a SPA template — use a Next/TanStack Start template for SSR |

## Variants

- **`mobile`**: `none`, `tauri`, `capacitor`
- **`ui`**: `none` (build your own), `shadcn`, `heroui` (v3), `base-ui`
- **`auth`**: `none`, `firebase`

## Stack

- **Runtime**: browser (Vite dev server, static deploy in prod)
- **Language**: TypeScript with strict + `noUncheckedIndexedAccess`
- **Build**: Vite 6
- **Routing**: TanStack Router (`@tanstack/router-plugin/vite` generates `routeTree.gen.ts`)
- **Data**: TanStack Query 5 (`queryOptions` from `@tanstack/react-query`, no custom wrapper)
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite`)
- **Test**: vitest
- **Lint**: `@biomejs/biome` extending `@milkyskies/biome-config`

## Directory layout

```
apps/{{app_name}}/
├── src/
│   ├── app/routes/         File-based routes; routeTree.gen.ts compiled by Vite plugin
│   ├── features/
│   │   └── <feature>/      Feature-scoped components, hooks, contexts
│   ├── services/
│   │   └── api/
│   │       ├── client.ts   hc<AppType>(baseUrl)
│   │       └── <resource>/ <resource>-keys.ts, get-*-query-options.ts, use-*-mutation hooks
│   ├── lib/
│   │   └── query/          queryClient, createMutationHook, createOptimisticMutationHook, optimistic-helper
│   ├── models/             <Resource>.ts — domain models with fromApi(dto) converter
│   ├── config/             Environment-derived constants
│   └── assets/             CSS, images
├── biome.json              extends @milkyskies/biome-config
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

## First-run

```bash
pnpm install
pnpm --filter '{{app_name}}' routes:generate
pnpm --filter '{{app_name}}' dev
```

Open `http://localhost:5173`. Routes auto-regenerate on file changes via the Vite plugin.

## The discipline

The `frontend-structure.md` rule file enforces:

- **Suspense-first**: `useSuspenseQuery` + `<Suspense>` boundary, never `useQuery` + `isLoading`.
- **Models own their wire conversion**: `User.fromApi(dto)` is called inside `queryFn`; components never see wire types.
- **Query Key Factory per resource**: `<resource>Keys.detail(id)` rather than inline `["resource", id]`.
- **TanStack v5 native `queryOptions()`**: do not write a custom wrapper.
- **No `index.ts` barrels**: import from specific files.
