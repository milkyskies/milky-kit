---
paths:
  - ".github/workflows/**/*.yml"
  - ".github/workflows/**/*.yaml"
  - ".github/scripts/**"
  - "package.json"
---

# CI conventions

Every workspace package that ships or builds code defines three scripts: `typecheck`, `lint`, `test`. CI runs them recursively across the workspace. A package missing any of the three fails the build — that's the enforcement, no PR can land a package without test/lint/typecheck wired up.

**Tooling-only manifests are exempt.** A root `package.json` whose only purpose is to install repo-wide CI tooling (e.g. biome + biome-config so the project's own CI can lint scaffolds) does not ship runtime code and does not get its own `typecheck` / `test` scripts. Such manifests carry only the scripts the tooling itself needs (typically just `lint` / `lint:fix`). The `check-package-scripts.sh` step skips manifests with `"private": true` and no `dependencies` block.

## Required scripts per package

```json
"scripts": {
  "typecheck": "tsc --noEmit",
  "lint": "biome check .",
  "test": "vitest run"
}
```

The exact commands vary (`@effect/vitest` users add `--reporter=verbose`, monorepos with codegen add a `prepare` step), but the names are fixed.

## CI job structure

The `ci.yml` workflow runs:

1. **Check package scripts** — `.github/scripts/check-package-scripts.sh` asserts every workspace package has the three scripts. Catches "added a package but forgot to wire up the test runner" at PR time.
2. **Install** — package manager's frozen-lockfile install (pnpm: `pnpm install --frozen-lockfile`; bun: `bun install --frozen-lockfile`).
3. **Lint** — recursive across packages.
4. **Typecheck** — recursive across packages.
5. **Test** — recursive across packages.

If any package's `lint`/`typecheck`/`test` fails, CI fails. No `--if-present` — missing scripts are the script-check step's job to catch.

## Scaffolded dummy test

Every scaffolded package ships a passing dummy test (e.g. `src/health.test.ts`) so `test` is green from day one. Adding a real test that fails then surfaces immediately.

## Convention: package script naming

- `typecheck`, not `tsc:check` or `check:types`.
- `lint`, not `biome:check` or `lint:biome`.
- `test`, not `vitest` or `test:unit`.

The names are what `check-package-scripts.sh` greps for, and what every package manager's `-r` invocation expects. Keep them boring.
