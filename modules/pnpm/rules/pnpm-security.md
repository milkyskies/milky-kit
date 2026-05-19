---
paths:
  - "package.json"
  - ".npmrc"
  - "pnpm-lock.yaml"
---

# pnpm supply-chain security

pnpm-specific controls. Runtime-neutral CI rules (OSV-Scanner, zizmor, pinned actions, no-GitHub-context-in-run) live in `modules/security/rules/security.md`.

Compromised npm packages are a recurring threat. The pattern is consistent: an attacker gains publish access to a popular package, ships a new patch version with malicious code (often in a postinstall script), and CI runners + dev machines auto-install it within minutes due to caret ranges. The bad version is detected and removed within hours — but a single `pnpm install` is enough to compromise a dev machine or CI runner.

This module ships layered controls so each stage of the attack is blocked by at least one mechanism.

## 1-day version cooldown

`.npmrc` sets `minimum-release-age=1440` (24h). pnpm refuses to install any package version published less than a day ago. Compromised versions are typically detected within hours; the cooldown ensures we never install one.

`.ncurc.json` mirrors this for `npm-check-updates`. `.github/dependabot.yml` mirrors it via `cooldown: { default-days: 1 }`.

**Bypassing for an urgent patch** (e.g. a CVE that just dropped): add the package to `minimum-release-age-exclude[]` in `.npmrc` in a PR with a written justification. Remove the entry once the cooldown for that version has passed naturally. Excluded packages still go through safe-chain + OSV-Scanner.

## Aikido safe-chain

CI runs `pnpm dlx @aikidosec/safe-chain@<pinned> setup-ci` **before** `pnpm install`. Installs PATH shims that wrap pnpm/npm/yarn/npx and check every package against Aikido's feed of known-malicious releases.

**Local dev** (one-time per machine, not auto-set-up):

```bash
npm i -g @aikidosec/safe-chain
safe-chain setup
```

## Install-script allowlist

`package.json` declares `pnpm.onlyBuiltDependencies`. pnpm v10 disables `preinstall`/`install`/`postinstall` scripts by default; only the listed packages can run them. Adding a new package to the list requires a PR.

The risky moment is bumping an already-allowlisted package — a compromised version inherits the allowance. The cooldown + safe-chain mitigate that.

## Pinned package manager

`packageManager: "pnpm@<version>"` + `engines.node` + `engine-strict=true` in `.npmrc`. Corepack rejects other package managers; install fails on a mismatched Node version. CI uses the exact pnpm version from `package.json`.

## Lockfile + frozen install

`pnpm-lock.yaml` is committed. CI runs `pnpm install --frozen-lockfile` so any drift between the lockfile and `package.json` fails the build instead of silently re-resolving (which would defeat the cooldown + trust-policy checks applied locally).

## Trust policy

`package.json` sets `pnpm.trustPolicy: "no-downgrade"` (pnpm ≥ 10.21). Refuses install if a package's trust level decreased compared to previously installed versions (e.g. previously published with provenance, new version doesn't). Catches the common compromise pattern where an attacker republishes from a stolen account without the original signing setup.

For legitimate exceptions: `pnpm.trustPolicyExclude` (package names that bypass) or `pnpm.trustPolicyIgnoreAfter` (skip for versions older than a duration). Use sparingly with written justification.

## Block exotic transitive deps

`pnpm.blockExoticSubdeps: true` (pnpm ≥ 10.26). Direct deps can still resolve from git URLs / tarballs / local paths when explicitly declared, but a transitive dep can never drag in code from outside the registry.

## Transitive dep overrides

`pnpm.overrides` pins a vulnerable transitive dep to a fixed version when the direct dep hasn't patched yet. Document each pin in a sibling `//overrides-<name>` key (sibling of `overrides`, not inside it — pnpm rejects `//`-prefixed package selectors). Example:

```json
"//overrides-esbuild": "GHSA-67mh-4wv8-2f99 — esbuild < 0.25.0 lets any website send requests to dev server.",
"overrides": {
  "esbuild": "^0.25.0"
}
```

Each override should:

1. Reference an OSV / CVE id in an adjacent `//overrides-<name>` comment so a future reader knows why the pin exists.
2. Be removed once the upstream direct deps have caught up — leaving stale overrides locks you out of legitimate version bumps.

OSV-Scanner CI surfaces these advisories — when a new advisory lands, add the override + commit the updated lockfile.

## Cooldown / zizmor mismatch (intentional)

zizmor's `dependabot-cooldown` rule wants ≥7 days. Our `.npmrc` mirrors a 1-day window (24h) — the cooldown window is a tradeoff between catching bad releases and not blocking urgent fixes. Suppress with an inline ignore so zizmor stays useful for the rules that matter:

```yaml
default-days: 1 # zizmor: ignore[dependabot-cooldown]
```

## When you bump dependencies

- Use Dependabot PRs (auto-respects cooldown). For urgent off-cycle bumps, add the package to `.npmrc`'s `minimum-release-age-exclude` with a justification, then remove once the cooldown passes.
- Never `pnpm update` blindly without reviewing the diff — that bypasses cooldown awareness for direct deps you're choosing to bump.
- After bumping, commit the updated `pnpm-lock.yaml`. CI's `--frozen-lockfile` will fail otherwise.
