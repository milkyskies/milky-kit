---
name: heroui-react
description: "HeroUI v3 React component library (Tailwind CSS v4 + React Aria). Use when working with HeroUI components, installing HeroUI, customizing HeroUI themes, or accessing HeroUI component documentation."
metadata:
  author: heroui
  version: "2.0.0"
---

# HeroUI v3 React Development Guide

HeroUI v3 is a component library built on **Tailwind CSS v4** and **React Aria Components**.

## CRITICAL: v3 Only — Ignore v2 Knowledge

| Feature       | v2 (DO NOT USE)                   | v3 (USE THIS)                               |
| ------------- | --------------------------------- | ------------------------------------------- |
| Provider      | `<HeroUIProvider>` required       | **No Provider needed**                      |
| Animations    | `framer-motion` package           | CSS-based, no extra deps                    |
| Component API | Flat props: `<Card title="x">`    | Compound: `<Card><Card.Header>`             |
| Styling       | Tailwind v3 + `@heroui/theme`     | Tailwind v4 + `@heroui/styles@beta`         |

**Always fetch v3 docs before implementing.** Do not assume v2 patterns work.

## Accessing Documentation

```bash
# List all available components
node scripts/list_components.mjs

# Get component documentation (MDX)
node scripts/get_component_docs.mjs Button

# Get component source code
node scripts/get_source.mjs Button

# Get component CSS styles
node scripts/get_styles.mjs Button

# Get theme variables
node scripts/get_theme.mjs
```

Direct MDX URLs: `https://v3.heroui.com/docs/react/components/{component-name}.mdx`

## Installation

```bash
npm i @heroui/styles@beta @heroui/react@beta tailwind-variants
```

CSS setup:
```css
@import "tailwindcss";
@import "@heroui/styles";
```

## Component Patterns

Compound components with dot notation:

```tsx
<Card>
  <Card.Header>
    <Card.Title>Title</Card.Title>
  </Card.Header>
  <Card.Content>{/* Content */}</Card.Content>
  <Card.Footer>{/* Actions */}</Card.Footer>
</Card>
```

## Semantic Variants

| Variant     | Purpose                           |
| ----------- | --------------------------------- |
| `primary`   | Main action to move forward       |
| `secondary` | Alternative actions               |
| `tertiary`  | Dismissive actions (cancel, skip) |
| `danger`    | Destructive actions               |

Use semantic variants — don't use raw colors.
