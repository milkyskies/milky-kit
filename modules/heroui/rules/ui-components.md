# UI Components: HeroUI v3

## CRITICAL: v3 Only — Ignore v2 Knowledge

HeroUI v3 is built on **Tailwind CSS v4** and **React Aria Components**.

| Feature       | v2 (DO NOT USE)                   | v3 (USE THIS)                               |
| ------------- | --------------------------------- | ------------------------------------------- |
| Provider      | `<HeroUIProvider>` required       | **No Provider needed**                      |
| Animations    | `framer-motion` package           | CSS-based, no extra dependencies            |
| Component API | Flat props: `<Card title="x">`    | Compound: `<Card><Card.Header>`             |
| Styling       | Tailwind v3 + `@heroui/theme`     | Tailwind v4 + `@heroui/styles@beta`         |
| Packages      | `@heroui/system`, `@heroui/theme` | `@heroui/react@beta`, `@heroui/styles@beta` |

## Core Principles

- Semantic variants (`primary`, `secondary`, `tertiary`) over visual descriptions
- Composition over configuration (compound components)
- CSS variable-based theming with `oklch` color space
- **Always use HeroUI semantic color tokens** — never raw Tailwind colors
- Use `tailwind-variants` (`tv`) for variant styling
- Use `onPress`, not `onClick` for better accessibility

## Component Patterns

```tsx
<Card>
  <Card.Header>
    <Card.Title>Title</Card.Title>
    <Card.Description>Description</Card.Description>
  </Card.Header>
  <Card.Content>{/* Content */}</Card.Content>
  <Card.Footer>{/* Actions */}</Card.Footer>
</Card>
```

## Icons

- **Lucide** icons, re-exported from `features/shared/icons/`

## Rules

- Always fetch v3 docs before implementing — do not assume v2 patterns work
- No `framer-motion` — v3 uses CSS animations
- Re-export components at `features/shared/ui/`
