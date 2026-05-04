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

## What's NOT here yet

- \`pnpm.trustPolicy: "no-downgrade"\` — refuses install if a package's trust level decreased (e.g. previously had provenance, new version doesn't). Tracked in milky-kit issue #8 — pending pnpm version availability.
- \`pnpm.blockExoticSubdeps: true\` — refuses transitive deps from non-registry sources. Same issue.

## When you bump dependencies

- Use Dependabot PRs (auto-respects cooldown). For urgent off-cycle bumps, add the package to \`.npmrc\`'s \`minimum-release-age-exclude\` with a justification, then remove once the cooldown passes.
- Never \`pnpm update\` blindly without reviewing the diff — that bypasses cooldown awareness for direct deps you're choosing to bump.
- After bumping, commit the updated \`pnpm-lock.yaml\`. CI's \`--frozen-lockfile\` will fail otherwise.
