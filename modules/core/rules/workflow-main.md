---
modes: [main]
---

# Task Workflow — `main` mode

When `.milky-kit-mode` is `main`, follow these steps (`workflow.md` holds what every mode shares).

### 1. Claim the issue

```bash
gh issue edit <num> --add-label stage:working --remove-label stage:ready --add-assignee @me
```

### 2. Verify branch is `main`

```bash
git branch --show-current   # must be `main`
```

If not on `main`, switch (`git checkout main`).

### 3. Work

Edit, build, test directly in the project root, on `main`. **Before writing new code, find a similar existing implementation in each layer you're about to touch and follow its patterns.**

Commit semi-frequently with `(#N)` issue refs in the message:

```bash
git add <specific files>
git commit -m "<type>(<scope>): <subject> (#<num>)"
```

Never `git add -A` or `git add .` — stage specific files.

### 4. Push directly

No PRs in `main` mode. Push to `main` after each meaningful commit (or batched, your call):

```bash
git push origin main
```

Run formatter + linter before every push. No exceptions.

### 5. Close the issue

```bash
gh issue edit <num> --add-label stage:done --remove-label stage:working
gh issue close <num> --comment "<short summary>"
```

For commits that fix the issue completely, include `closes #<num>` in the commit body so GitHub also closes via the commit.
