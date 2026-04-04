# Client App (Tauri)

## Tauri v2

- Desktop + mobile from one codebase
- React frontend with TanStack Router (file-based routing)
- Run with `cd apps/client && pnpm tauri dev`

## Mobile-first Responsive Design (MANDATORY)

- Stack on mobile, row on desktop
- Use `md:` and `lg:` breakpoints (Tailwind defaults: mobile < 768px, md >= 768px, lg >= 1024px)
- Always test at 375px, 768px, 1280px
- Full-width on mobile, constrained on desktop

## Rules

- **No debug features** — no dev panels, toggles, raw IDs, console logs in the client app
- This is a customer-facing product — audience is Members, Admins, Owners
- Role-gate UI appropriately
