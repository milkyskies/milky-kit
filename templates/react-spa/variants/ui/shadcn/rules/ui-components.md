# UI Components: shadcn/ui (Base UI)

## Library

- **shadcn/ui** components with **Tailwind CSS v4**, generated on top of **Base UI** (`@base-ui/react`) primitives, not Radix
- Before using a native HTML element, check if `features/shared/ui/` has a component for it

## components.json

`components.json` ships pre-configured — do not run `shadcn init` against a fresh config and do not change `style` casually. The `style` prefix is what selects the primitive library:

| Prefix | Primitive |
|---|---|
| `base-*` | Base UI |
| `radix-*` | Radix |
| `aria-*` | React Aria |

This project is on `base-vega`. Changing the prefix means re-generating every component with `pnpm dlx shadcn@latest add --all --overwrite`, so treat it as a migration, not a settings tweak.

Adding a component:

```bash
pnpm dlx shadcn@latest add button
```

The CLI resolves the aliases in `components.json`, so primitives land in `features/shared/ui/` and composed blocks in `features/shared/components/` — never shadcn's stock `components/ui/`.

## Base UI differences from Radix

- **`render` replaces `asChild`.** Base UI takes a render prop where Radix took a boolean, so polymorphism looks like `<Button render={<Link to="/posts" />}>` rather than `<Button asChild><Link /></Button>`. The shadcn CLI converts this during generation; you only hit it when hand-writing call sites.
- **Import from the specific entry point** when reaching for a primitive directly: `@base-ui/react/dialog`, `@base-ui/react/popover`. Better tree-shaking.
- **Part names differ.** Base UI uses `Popup` where Radix used `Content`, and adds `Backdrop`. Follow the generated component, not Radix muscle memory.

## Icons

- **Remix Icon** primary, **Lucide** secondary
- Re-export from `features/shared/icons/`

## Patterns

- Use shadcn form components — no raw HTML `<form>`, `<input>`, `<select>`
- Semantic Tailwind classes: `bg-background`, `text-foreground`, `border-border`, etc.
- Support light and dark themes via semantic color tokens
