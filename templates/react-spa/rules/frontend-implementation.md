# Frontend Implementation Rules

## Components

- **Props**: Define as `interface {ComponentName}Props`, use `function` declarations
- **Never destructure props** — access via `props.` prefix
- Custom components go in `features/shared/components/` (reusable) or `features/{name}/components/` (scoped)
- **Prefer shared over one-off** — default to reusable

## Styling: `cn` vs `tailwind-variants`

Two tools, different jobs — use both.

- **`cn` (`lib/utils.ts`)** merges class strings: conditional joining (clsx) + Tailwind conflict resolution (tailwind-merge). Reach for it for ad-hoc classes and for merging an incoming `className` prop with a component's defaults.
- **`tailwind-variants` (`tv`)** defines a component's styling as a base + named variants + `defaultVariants`. Reach for it for any reusable component with more than one style dimension (variant, size, state). It uses `tailwind-merge` under the hood and adds slots, compound variants, and responsive variants.

The variant definition is the unit of reuse — keep it in `features/shared/ui/<name>.ts` (your design-system primitives) and apply it to any element:

```ts
// features/shared/ui/button.ts
import { tv } from "tailwind-variants"

export const button = tv({
	base: "inline-flex items-center justify-center rounded-md font-medium transition active:scale-95 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40",
	variants: {
		variant: {
			primary: "bg-primary text-primary-foreground hover:opacity-90",
			ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
		},
		size: { sm: "px-3 py-1.5 text-sm", md: "px-4 py-2 text-sm" },
	},
	defaultVariants: { variant: "primary", size: "md" },
})
```

```tsx
<button type="button" className={button({ variant: "ghost", size: "sm" })}>Cancel</button>
```

Don't hand-roll long `cn(...)` conditional ladders for a component that has real variants — that is exactly what `tv` replaces. Reserve `cn` for one-offs and `className` merging.

**shadcn projects are the exception**: shadcn ships its own components built on `class-variance-authority` (CVA). Stay with CVA there for consistency with the generated components; use `tv` everywhere else.

## Routing

- Folder-based routes (no dots in path segments)
- `route.tsx` for layout wrappers, `index.tsx` for page content
- Run `pnpm routes:generate` after adding/changing routes

## Data Fetching

- Always `useSuspenseQuery` — never `useQuery` with `isLoading` checks
- Wrap in `<Suspense>` boundaries
- Never use `enabled` option — use conditional rendering instead
- Use `useTransition` for non-urgent state updates that trigger Suspense (e.g. tab switches, filter changes)
- Use `useDeferredValue` for deferring expensive re-renders (e.g. search input filtering a large list)
- Never fall back to `useQuery` + `isLoading` to avoid Suspense — use `useTransition`/`useDeferredValue` instead
- Use `/setup-api-client` skill to scaffold the query layer for new resources

## Naming

- No single-letter variables (e, res, m, t, n, i) except in short lambdas where context is obvious

## Rules

- **No `index.ts` barrel files**
- Run `pnpm check` when finished
- Always use `@/` path alias for imports
- No raw HTML forms — use the UI library's form components
- Error boundaries alongside Suspense boundaries
