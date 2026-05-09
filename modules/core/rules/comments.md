# Comments

**MANDATORY. Read before writing any comment. The default is no comment.**

A comment is a liability. It rots when the code around it changes, it bloats diffs, and most of the time it just restates what a well-named identifier already says. Write code so the comment isn't needed; only reach for one when the code physically cannot carry the meaning.

## The only reasons to write a comment

A comment is justified when it captures **WHY** that the code itself cannot:

1. **A non-obvious constraint** imposed from outside the file. Example: "must be exported as `config` because the babel plugin looks it up by that name."
2. **A subtle invariant** a reader could plausibly break. Example: "compare by `uid`, not reference, because Firebase hands us a new `User` object on every token refresh."
3. **A workaround for a specific upstream bug or platform quirk**, with enough detail to know when it can be removed.
4. **A deliberate choice between two reasonable options**, where the reader would otherwise rewrite it. Example: "imperative API chosen over hook-based because mutation callbacks fire outside render."
5. **A `TODO(#issue)` or `FIXME(#issue)`** linked to a tracked issue. No bare `TODO` without a number.

If the comment doesn't fit one of those, delete it.

## Forbidden comments

These are deleted on sight:

- **Narration of what the code does.** `// fetches the user`, `// loop over items`, `// sets up providers`. The names already say it.
- **Section banners.** `// --- Helpers ---`, `// State`, `// Effects`. Use blank lines and structure.
- **"Mirrors X" / "ported from Y" pointers** to other files in the same repo. Git history and grep find this; the comment goes stale the moment either side moves.
- **"Real version lands in #N" / future-tense narrative** about work that hasn't happened. Use a real `TODO(#N)` only at the exact line that needs to change, not as a file header.
- **Restating the type or signature.** `// returns a Promise<User>` next to a typed return.
- **Apology / temporary-marker prose.** `// temporary FAB`, `// quick hack for now`. Either link a `TODO(#N)` or don't write it.
- **`// removed:` / `// was: ...`** breadcrumbs for deleted code. Just delete.
- **Multi-paragraph essays** that read like a design doc. Design docs go in `docs/`. Inline comments stay tight.

## Form rules

- **Proper sentences.** Capital letter, period at the end. `// Cache style at module scope so navigating away does not refetch.` not `// cache style — no refetch`.
- **No manual line wrapping.** Write one logical line per sentence and let the formatter (Biome / Prettier) wrap it. Never hand-break mid-word like `// trans-` / `// literation`. In Rust, where `cargo fmt` does not wrap comments, keep each sentence on one line — if it is too long for one line, the comment is too long and should be split into shorter sentences or moved to docs.
- **No ASCII art, no decorative dashes**, no boxed banners.
- **Doc comments (`///`, `/** */`, JSDoc) only on exported public API** where the doc tool actually surfaces them. Internal helpers get plain `//` or nothing.
- **One blank-line gap above** a comment that explains the next block; no blank line between the comment and the line it describes.

## Before you write a comment, try these first

1. **Rename.** A clearer variable / function name removes the need for the comment 80% of the time.
2. **Extract a function.** A well-named helper documents itself.
3. **Move it to the PR description or commit message** if it's about *why this change exists*, not why this code exists.
4. **Move it to `docs/`** if it's a multi-paragraph explanation of an architectural decision.

Only after those fail is a comment the right tool.

## Examples

**Bad** — narrates code:
```ts
// Set up the providers
export function AppProviders({ children }: Props) { ... }
```

**Bad** — placeholder pointer that will rot:
```ts
// Mirrors apps/client/src/app/routes/_authed/_onboarded/_home/friends.tsx.
// Real screen lands in #82.
export default function Friends() { ... }
```

**Bad** — hand-wrapped, sentence fragment:
```ts
// cache the fetched + transformed style at module scope so navigating
// away and back doesn't re-fetch — map nav is the hot path; the style
// payload is stable for the app session
```

**Good** — load-bearing WHY, proper sentence, formatter handles wrapping:
```ts
// Cache the transformed style at module scope so route changes do not refetch; the payload is stable for the app session.
const styleCache = new Map<string, StyleSpec>();
```

**Good** — names a constraint the reader would otherwise break:
```ts
// Compare by uid because Firebase issues a new User object on every token refresh, and reference equality would churn the snapshot and restart route loaders.
if (prev?.uid === next?.uid) return prev;
```

**Good** — linked TODO at the exact line:
```ts
// TODO(#82): redirect to /onboarding when meQueryOptions resolves to None.
return <Slot />;
```
