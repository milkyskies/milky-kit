# UI Components: Base UI

## Library

- **Base UI** (`@base-ui/react`) — unstyled, accessible primitives from the team behind MUI
- Headless: every part is a separate subcomponent (`Root`, `Trigger`, `Popup`, etc.) that you style yourself

## Styling approach — Tailwind v4 + theme tokens

The project ships a token system in `src/assets/styles.css`. **Use the Tailwind utilities, not arbitrary `var(...)` syntax**, in component classes:

```tsx
// ✓ Use the generated utilities — semantic, terse
<button className="bg-primary text-primary-foreground rounded-md px-3 py-1.5">

// ✗ Don't use arbitrary values — verbose, no Tailwind variants
<button className="bg-[var(--primary)] text-[var(--primary-foreground)]">
```

How it works (one-time setup, already done in `styles.css`):

- Tokens live in `:root` / `.dark` as `--background`, `--foreground`, `--primary`, etc.
- An `@theme inline` block in `styles.css` aliases each one to `--color-<name>`
- Tailwind v4 sees those `--color-*` aliases inside `@theme` and auto-generates utilities (`bg-<name>`, `text-<name>`, `border-<name>`, `ring-<name>`, etc.)

**To add a new token:** declare it in both `:root` and `.dark`, then add the alias inside `@theme inline`. The utility appears automatically.

## Light / dark mode

The dark theme activates when the `.dark` class is on a parent (typically `<html>` or `<body>`). Toggle programmatically; do not rely on `prefers-color-scheme` alone.

## Component patterns

```tsx
import { Dialog } from "@base-ui/react/dialog";

<Dialog.Root>
  <Dialog.Trigger className="bg-primary text-primary-foreground rounded-md px-3 py-1.5">
    Open
  </Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Backdrop className="fixed inset-0 bg-black/40" />
    <Dialog.Popup className="fixed inset-0 m-auto p-6 rounded-lg bg-background text-foreground border border-border">
      <Dialog.Title>Title</Dialog.Title>
      <Dialog.Description className="text-muted-foreground">Description</Dialog.Description>
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

- **Always import each Base UI component from its specific entry point**: `@base-ui/react/dialog`, `@base-ui/react/popover`, etc. Better tree-shaking.
- **Always use semantic Tailwind utilities (`bg-primary`, `text-muted-foreground`)**, never raw color values like `bg-blue-500` or `bg-[#abc]`. The token system is the single source of truth for color.
- **Never use arbitrary `var(...)` values for tokens that already have a generated utility.** If `bg-foo` doesn't exist, you missed adding the alias inside `@theme inline`.
- Use `useRender` for headless / "render-prop" customizations rather than reaching into refs.
