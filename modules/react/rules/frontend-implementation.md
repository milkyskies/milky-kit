# Frontend Implementation Rules

## Components

- **Props**: Define as `interface {ComponentName}Props`, use `function` declarations
- **Never destructure props** — access via `props.` prefix
- Custom components go in `features/shared/components/` (reusable) or `features/{name}/components/` (scoped)
- **Prefer shared over one-off** — default to reusable

## Routing

- Folder-based routes (no dots in path segments)
- `route.tsx` for layout wrappers, `index.tsx` for page content
- Run `pnpm routes:generate` after adding/changing routes

## Data Fetching

- Always `useSuspenseQuery` — never `useQuery` with `isLoading` checks
- Wrap in `<Suspense>` boundaries
- Never use `enabled` option — use conditional rendering instead
- Use `/setup-api-client` skill to scaffold the query layer for new resources

## Models

- Never import `*Dto` directly in components
- Create a model at `src/models/` with a `.fromApi()` converter
- Components import from `@/models/`, never from `@/services/api/_generated/schemas`

## Naming

- No single-letter variables (e, res, m, t, n, i) except in short lambdas where context is obvious

## Rules

- **No `index.ts` barrel files**
- Run `pnpm check` when finished
- Always use `@/` path alias for imports
- No raw HTML forms — use the UI library's form components
- Error boundaries alongside Suspense boundaries
