---
paths:
  - "package.json"
  - "bunfig.toml"
  - "bun.lockb"
---

# Bun supply-chain security (with honest gaps)

Bun's supply-chain story is weaker than pnpm's. This file documents what Bun currently offers and what it doesn't, so the decision to use Bun is made with eyes open. Runtime-neutral CI rules (OSV-Scanner, zizmor, pinned actions) live in `modules/security/rules/security.md`.

## What Bun offers

### `trustedDependencies`

Like pnpm's `onlyBuiltDependencies`. Lists packages allowed to run install scripts:

```json
{
  "trustedDependencies": ["@biomejs/biome", "esbuild"]
}
```

Adding to this list requires a PR. Same caveat as pnpm: bumping an already-trusted package inherits the allowance — review the diff.

### Frozen lockfile

`bun install --frozen-lockfile` in CI fails the build if `bun.lockb` is out of sync with `package.json`. Same property as pnpm's frozen install.

### Lockfile is committed

`bun.lockb` (binary) goes in git. Bun also writes `bun.lock` (text) optionally — prefer the binary form for stable diffs.

### `--save-text-lockfile`

When investigating a lockfile diff, regenerate `bun.lock` (text) via `bun install --save-text-lockfile` for review. Don't commit it; it's a debugging aid.

## What Bun does NOT offer (gaps)

These are real gaps as of Bun 1.x. Mitigations require external tooling or accepting risk.

### No version cooldown

Bun has no equivalent of pnpm's `minimum-release-age`. A compromised package version is installable the moment it's published.

**Mitigation:** rely on `@aikidosec/safe-chain` (works with Bun via PATH shims) to block known-malicious releases, and on OSV-Scanner for after-the-fact detection. Accept that the "first 24h" window pnpm closes is open here.

### No trust policy

No equivalent of pnpm's `no-downgrade` trust policy. If a package switches from provenance-signed to unsigned, Bun installs it silently.

**Mitigation:** none built in. Manual diff review on lockfile changes.

### No `blockExoticSubdeps`

A transitive dep can resolve from a git URL or local tarball if a direct dep declares it that way. pnpm blocks this; Bun does not.

**Mitigation:** audit `bun.lockb` periodically (or use the text form via `--save-text-lockfile`) for non-registry sources.

### Weaker overrides

`overrides` exist in Bun but with less stable resolution semantics than pnpm. Test thoroughly when pinning a transitive dep.

## When to use Bun anyway

- Single-app projects where you accept the gaps.
- Bun-runtime backends (the runtime wins more than the supply-chain story loses).
- Personal scripts (`templates/bun-scripts`).
- Anywhere pnpm's workspace overhead isn't worth it.

For multi-app monorepos with anything serious in production, prefer `modules/pnpm`. The supply-chain controls there are mature; Bun's story is improving but not equivalent yet.
