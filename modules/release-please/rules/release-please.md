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

## NPM_TOKEN secret

For projects with `variants/publish/npm/`, the GitHub repo needs an `NPM_TOKEN` secret containing a granular automation token scoped to the publish org (e.g. `@milkyskies`), with read+write on the relevant packages. `npm publish --provenance` uses GitHub OIDC for the actual publish trust, but the CLI auth check still wants `NODE_AUTH_TOKEN` set from `NPM_TOKEN`.

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
