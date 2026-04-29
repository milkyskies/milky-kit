# UI Components: Base UI

## Library

- **Base UI** (`@base-ui/react`) — unstyled, accessible primitives from the team behind MUI
- Headless: every part is a separate subcomponent (`Root`, `Trigger`, `Popup`, etc.) that you style yourself

## Styling approach

- **Tailwind CSS v4** with project-defined CSS variables in `src/assets/styles.css`
- Component styling is direct on each Base UI part — no shared theme provider
- Reference variables via `bg-[var(--color-primary)]` etc. (Tailwind v4 understands custom properties)
- Always use semantic tokens (`--color-primary`, `--color-muted-foreground`, etc.) — never raw color values in component classes
- Light + dark mode handled by re-defining variables in `@media (prefers-color-scheme: dark)`

## Component patterns

```tsx
import { Dialog } from "@base-ui/react/dialog";

<Dialog.Root>
  <Dialog.Trigger className="px-3 py-1.5 rounded-[var(--radius)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">
    Open
  </Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Backdrop className="fixed inset-0 bg-black/40" />
    <Dialog.Popup className="fixed inset-0 m-auto p-6 rounded-[var(--radius)] bg-[var(--color-background)] text-[var(--color-foreground)]">
      <Dialog.Title>Title</Dialog.Title>
      <Dialog.Description>Description</Dialog.Description>
    </Dialog.Popup>
  </Dialog.Portal>
</Dialog.Root>
```

## Wrapping

Wrap commonly-used compositions in `features/shared/components/` so consumers get a single import (e.g. `<ConfirmDialog />`) rather than re-assembling the Dialog parts every time.

## Icons

- **Lucide** icons. Import directly from `lucide-react` (no barrel) — `import { Plus } from "lucide-react"`.
- If you need a wrapped/branded icon, give it its own file in `features/shared/icons/<name>.tsx`.

## Rules

- Always import each Base UI component from its specific entry point: `@base-ui/react/dialog`, `@base-ui/react/popover`, etc. Better tree-shaking and clearer dependency graphs.
- Add `isolation: isolate` to `html` (already in `styles.css`) so Base UI portals stack correctly.
- Use `useRender` for headless / "render-prop" customizations rather than reaching into refs.
