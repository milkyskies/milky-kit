---
paths:
  - ".github/release-please-config.json"
  - ".github/release-please-manifest.json"
  - ".github/workflows/release-please.yml"
  - ".github/workflows/release.yml"
  - "CHANGELOG.md"
---

# Release with release-please

Every milky-kit project ships [release-please](https://github.com/googleapis/release-please) as the release mechanism. Conventional commits land on `main`; release-please opens a "Release X.Y.Z" PR that bumps the version and writes the CHANGELOG; merging that PR creates the git tag, the GitHub release, and (for npm projects) triggers the publish workflow.

This module owns four files:

- `.github/release-please-config.json` — what packages to release, how to bump versions
- `.github/release-please-manifest.json` — the current version per package (release-please maintains this)
- `.github/workflows/release-please.yml` — opens the release PR, creates the tag on merge
- `.github/workflows/release.yml` — post-tag work (npm publish, GitHub release artifact upload, etc.)

## Conventional commits

Commit subjects follow `<type>(<scope>)!?: <subject>`:

| Type | Effect on version (pre-1.0) | Effect post-1.0 |
|---|---|---|
| `feat:` | patch bump | minor bump |
| `fix:` | patch bump | patch bump |
| `feat!:` / `BREAKING CHANGE:` footer | minor bump | major bump |
| `chore:`, `docs:`, `style:`, `refactor:`, `test:`, `ci:`, `build:` | no bump | no bump |

The `bump-minor-pre-major` + `bump-patch-for-minor-pre-major` flags in `release-please-config.json` keep 0.x.y projects on the conservative pre-1.0 cadence. Flip them off when graduating to 1.0.

## The release PR

Every push to `main` with a commit that affects the version causes release-please to open or update a single "Release X.Y.Z" PR. The PR:

- Bumps `version` in `package.json` (or `Cargo.toml`, etc. — declared via `extra-files`).
- Updates the manifest.
- Writes the CHANGELOG.md.

Merging the PR is what cuts the release. Don't squash-merge — use a merge commit so the release-please bot's commit is preserved in history. (Or configure release-please to handle squashes; either works as long as the team agrees.)

## Pre-1.0 alpha pinning (optional)

For projects that want to stay at `0.x.y-alpha.N` while iterating (floe's pattern), add `pin-alpha.yml` that appends an empty `Release-As: 0.x.y-alpha.<N+1>` trailer commit after every user push. Skip this for projects that just want normal semver patches/minors.

## npm Trusted Publishing (OIDC)

For projects with `variants/publish/npm/`, authentication uses **npm Trusted Publishing** via OIDC — no long-lived `NPM_TOKEN` secret. The release workflow declares `permissions: id-token: write` and `npm publish` exchanges the GitHub OIDC token for short-lived publish credentials.

One-time setup per package, on npm:

1. Go to the package's settings (`npmjs.com/package/<pkg>/access`).
2. Add Trusted Publisher → GitHub Actions.
3. Fill: owner, repository, **workflow filename = `release-please.yml`** (the *caller* workflow; npm authorizes the workflow that initiates the run, not the reusable callee).
4. Environment name: leave blank unless using GitHub deployment environments.

Provenance attestations are automatic under Trusted Publishing — no `--provenance` flag needed. Requires npm CLI ≥ 11.5.1; the shipped workflow runs `npm install -g npm@latest` before publishing since node 22 LTS ships with npm 10.x.

Two GitHub repo settings must be enabled (one-time, per repo):

- **Settings → Actions → General → Workflow permissions**: check "Allow GitHub Actions to create and approve pull requests" so release-please can open the release PR.
- No `NPM_TOKEN` secret needed (delete it if you had one from a pre-OIDC setup).

## Manual first release

release-please needs a starting point. If a package was published manually at `X.Y.Z` before this module was applied, set the manifest to that version:

```json
{ ".": "X.Y.Z" }
```

The next release PR proposes `X.Y.(Z+1)` (or whatever the bump computes from accumulated commits).

## Don't

- Don't `git tag` manually. release-please owns tag creation.
- Don't bump `version` in `package.json` by hand. release-please owns version writes.
- Don't `npm publish` from a dev machine for releases — the release workflow does it with provenance. Manual `pnpm publish` is only for the initial bootstrap publish before release-please is wired up.
