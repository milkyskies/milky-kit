# The desk: phase 5 design

Phase 2 put every piece of desk state on GitHub Issues: stages are labels, and claims, cards, results and answers are comments with `<!-- desk:* -->` markers. Today Milky reads that state in the GitHub app and answers with `/decisions` in a terminal. Phase 5 of [the desk plan](plan.md) builds the web app from plan section 3, so Milky never opens GitHub Issues by hand.

The desk is a small server on ceres, deployed with Dokploy and reachable only over Tailscale, next to ntfy at `http://ceres:8091`. The server holds the GitHub credential, so no browser holds a token. It serves the web app and polls GitHub every 45 seconds with conditional requests, so a change an agent makes reaches the screen within a minute, and a change Milky makes shows at once. On the phone, Milky opens the home screen, sees "Counter accents (kansai-2), 2 questions" under NEEDS YOU, taps it, and picks LHL for 三時. The server turns that tap into `desk answer` on the issue, and the project's coordinator picks the request up on its next pass. The desk lives in its own repository.

The desk adds no state of its own. Every screen is a view of labels and markers that phase 2 already defined, and every button is a comment or a `desk` command. The coordinators keep running as phase 2 built them, plus the frontman dispatch in section 6. They never talk to the server, and the server never talks to Orca.

**Status.** Not built; every design question is answered except the names, and most answers are kansai-2 proposals Milky confirmed on 2026-10-17 (listed at the end) · **Owns.** the desk server's endpoints, its read model and live updates, the mapping from each screen to GitHub reads and writes, the deployment on ceres, and the phase 5 build split

Each call below comes from one of four places:

- **Plan**: settled with Milky in [the desk plan](plan.md).
- **Milky**: stated by Milky (ceres, Dokploy, Tailscale only, the server holds the credential, its own repository, and the wish to talk to agents through Claude mobile or Orca).
- **Relayed**: answered by the kansai-2 agent when this design's cards were put to it, and confirmed by Milky on 2026-10-17. Each one is listed in [the last section](#relayed-proposals-confirmed-by-milky).
- **Small call**: decided by this design, listed in section 11 as `Auto-decided: X over Y because Z`.

## 1. The pieces

```
PHONE or MAC (Tailscale on)
   │ https://desk.<tailnet>.ts.net
   ▼
CERES ─ Dokploy compose app "desk"
   ├─ tailscale sidecar: node "desk", serves 443 to the tailnet only
   └─ desk server: web app files, /api/*, /api/events (SSE)
          │ polls GitHub every 45 s (conditional REST), re-reads changed issues (GraphQL)
          │ runs the `desk` program for every state change
          │ polls its own repository's main, and calls Dokploy's deploy API on a new commit
          ▼
       GITHUB ISSUES + LABELS ◄── coordinators and workers (phase 2, plus the frontman)

ntfy on ceres:8091 ◄── `desk digest` from each coordinator (phase 2, link now opens the desk)
```

Nothing on ceres is reachable from the internet (relayed).

- **The server reads GitHub and parses it with the `desk` program's own parsers.** `modules/desk/cli/src/github/` holds the marker grammar, the derived values (owning claim, attempts, last human comment), the body sections and the card validator as pure functions with no I/O (`markers.ts`, `derive.ts`, `body.ts`, `cards.ts`, `parseIssue` in `issue.ts`). The server imports them, so a card means the same thing on the desk as in `desk reconcile`.
- **The server changes state only through `desk` commands, or through a plain comment that a coordinator already knows how to read.** A comment the server posts carries no `<!-- desk:agent -->` marker, because it is Milky's words, and phase 2 treats every unmarked comment as the human's.
- **The server never runs a coordinator command.** `desk claim`, `desk release`, `desk reopen`, `desk merge` and `desk land` stay with the coordinator. "Looks good" is a comment; the coordinator's `looks-good` mismatch then runs `desk merge`.
- **The server gets the `desk` program as a package** (relayed): milky-kit publishes `modules/desk/cli` to GitHub Packages as a private package with a `desk` bin and its parsers exported, and the desk repository adds it with `pnpm add`. The desk pins a version, so a kit change cannot alter how the desk reads a card without a deploy.

## 2. What each screen reads and writes

The screens are plan section 3. "Open cards" below means the `desk:decision` comments from the newest park on the issue that have no answer yet, matched by card id (section 9).

### Home

One list across every repository in `DESK_REPOS`, sorted by section.

| Section | Reads | Each row shows |
|---|---|---|
| ✏️ I want… | the repository list, and each repository's default ask from its `## desk` section | the input box (section 6) |
| 🔔 NEEDS YOU | open issues with `stage:needs-you` | title, repository, the count of open cards |
| 👀 DONE, CHECK IT | open issues with `stage:check` | title, repository, the first picture in the newest `desk:result` comment |
| 🆕 PROPOSED BY AGENTS | open issues with `proposed` and `stage:intake` | title, repository, the request that proposed it (the `desk:proposed-request issue=<n>` marker on the source issue), and the ✓ start and ✗ drop buttons |
| ⏳ WORKING | open issues with `stage:working` | title, repository, time since the owning claim's `at=` |
| QUEUED | open issues with `stage:ready`, and `stage:intake` without `proposed` | title, repository, "waiting for a coordinator" on an intake request with no frontman claim after 10 minutes (section 6) |
| Later (n) | open issues with `stage:backlog` | one collapsed line at the very bottom; tapping it opens the backlog list |

QUEUED and Later are relayed: a request Milky just answered must not disappear from home before a worker claims it, and Milky often parks things for later, so the backlog needs a place that is never in the way. Issues with `bad-labels` (no stage label, or two) show in a line below Later, because the digest already reports them and the desk must not hide an issue the coordinator ignores.

Home writes nothing except ✓ start and ✗ drop:

| Button | Runs | What happens next |
|---|---|---|
| ✓ start | `desk accept <n>` (new, section 9): removes `proposed`, leaves `stage:intake` | the frontman writes the request up (section 6) |
| ✗ drop | `desk drop <n>` (new, section 9) | the issue closes as not planned at `stage:done` |

### One request

| Part (plan order) | Reads |
|---|---|
| Your own words, verbatim | the body's `## Your words` section, written once by `desk intake` (section 6); for an issue filed another way, the body's `## Problem` |
| Open question cards | the open cards, in the order the worker posted them |
| Decisions so far, with dates | the body's `## Decisions` lines (`- <date>: <decision>`), written by `desk answer` |
| The agent's small calls | the body's `## Small calls` lines, written by `desk note`, each with an overturn control |
| Pictures | every image in `desk:result` comments, newest first |
| Requests it spawned | every `desk:proposed-request issue=<n>` marker on the issue, with each target's stage |
| 💬 | a link, section 7 |

The stage, the pull request and the attempt count sit in one line under the title. The full comment thread is one tap away for anything the screen does not render.

**Overturning a small call** (relayed) reuses two paths phase 2 already reads. On `stage:check`, the control posts `no, because <the small call> should be <Milky's text>`, which the coordinator's `rejected` mismatch turns into `desk reopen`, because overturning a call on a finished request means the code must change. On any other stage, it posts the same text as a plain comment, which the live worker reads ("the latest comment wins") or the coordinator's `conversation` mismatch forwards.

### A question card

The card renders the comment's parts: background, `**Already checked:**`, `**Question:**`, the numbered 提案 options, "other…", and "💬 talk about this first". A code-detail card shows its `**Recommendation:**` line. A design card shows its `<details><summary>What would I pick?</summary>` block collapsed, the same way GitHub does, so the pick stays hidden until tapped.

Tapping an option, or typing into "other…", calls `POST /api/requests/:owner/:repo/:n/answers`. The server writes the answer file and runs:

```
desk answer <n> --repo <owner>/<repo> --card <card id> --body <file> --decision "<say-back line>"
```

**Several cards on one request.** The plan settles one decision per card, answered one at a time. So `desk answer --card` records one card's answer and its `## Decisions` line, and moves the request to `stage:ready` only when every card from the newest park has an answer (plan for the behaviour, relayed for the mechanism). Today `desk answer` requeues after the first answer (`modules/desk/cli/src/commands/answer.ts:43-52`), which section 9 changes.

**The say-back line.** The plan settles that the card says the answer back in one line ("三時 = LHL. 〜時 follows 三") before showing the next card. The worker writes that line when it parks the card: each option carries `→ <say-back line>` after its consequence (relayed). The desk passes the chosen option's line as `--decision`, so the line Milky sees is the line in `## Decisions`. An "other…" answer uses the typed text, and the next worker that picks the request up appends the consequence to that `## Decisions` line.

### Done, check it

| Part | Reads |
|---|---|
| Picture | the images in the newest `desk:result` comment, through the server's picture proxy (section 3) |
| One plain sentence | the result's summary line |
| Decisions and small calls | the result's `**Decisions used:**` line and the body's `## Small calls` |
| How to see it | the result's `**See it yourself:**` line, when present |
| Checks | the pull request's mergeable state and its check rollup |

The two buttons post plain comments. Phase 2's reconcile already reads both:

| Button | Comment posted | Coordinator mismatch | Command it runs |
|---|---|---|---|
| looks good | `looks good` | `looks-good` (`/^looks good/i` on the newest human comment after the result) | `desk merge` |
| no, because… | `no, because <Milky's reason>` | `rejected` (`no` as the first word) | `desk reopen` |

The server never merges. `desk merge` stays the one path (phase 2), and it re-checks the comment after its local check, so a "no, because…" sent during a merge still wins.

### Pings

Pings stay with `desk digest` in each coordinator, sent to ntfy on ceres (phase 2). The server sends none, so one event never pings twice. The digest's link changes from a GitHub search to the desk home when `DESK_APP_URL` is set (section 9).

## 3. The server

### Endpoints

| Method and path | Does |
|---|---|
| `GET /` and every non-API path | the web app's built files, with `index.html` as the fallback for client routes |
| `GET /api/home` | the home sections across every repository |
| `GET /api/requests/:owner/:repo/:n` | one request: words, open cards, decisions, small calls, pictures, spawned requests, stage line |
| `GET /api/events` | the SSE stream (below) |
| `GET /api/pictures/:owner/:repo/:n/:file` | streams a picture from the `desk-pictures` branch with the server's credential |
| `POST /api/requests` | a new request: `{ repo, words, ask }` → `desk intake` (section 6) |
| `POST /api/requests/:owner/:repo/:n/answers` | `{ card, option }` or `{ card, text }` → `desk answer --card` |
| `POST /api/requests/:owner/:repo/:n/verdict` | `{ verdict: "looks-good" }` or `{ verdict: "no", reason }` → a plain comment |
| `POST /api/requests/:owner/:repo/:n/proposal` | `{ action: "accept" }` or `{ action: "drop" }` → `desk accept` or `desk drop` |
| `POST /api/requests/:owner/:repo/:n/overturn` | `{ line, text }` → the comment for the request's stage (section 2) |
| `GET /healthz` | 200 when the last poll of every repository succeeded within three poll intervals |

The picture proxy exists because the `desk-pictures` links in result comments point at a private repository, and the phone's browser is not logged in to GitHub. Every POST runs one `desk` command or posts one comment, re-reads the issue, and returns the fresh request, so Milky's own taps show at once and the screen shows what GitHub holds, never an optimistic guess.

### The read model and polling

The server keeps one in-memory copy of each repository's open issues, filled by the same GraphQL shape `desk reconcile` uses: labels, body, the last 50 comments, and `closedByPullRequestsReferences` with state, draft flag, mergeable state and check rollup. Nothing is written to disk; a restart costs one full read.

There are no webhooks (relayed). GitHub cannot reach a Tailscale-only ceres, and every way to bring webhooks in exposes something to the internet or adds an account. Polling exposes nothing:

1. **Every `DESK_POLL_SECONDS` (default 45)**, for each repository, the server sends `GET /repos/{owner}/{repo}/issues?state=all&sort=updated&direction=desc&since=<window start>&per_page=100` with the `If-None-Match` ETag of the previous answer. An unchanged answer is `304 Not Modified`, and GitHub does not count an authenticated 304 against the primary rate limit.
2. **A 200** lists every issue and pull request updated since the window start. The server re-reads by GraphQL only those whose `updated_at` is newer than its copy. A changed pull request also re-reads the issues it closes.
3. **Every `DESK_RESYNC_SECONDS` (default 300)** the server reads every repository in full by GraphQL and moves the window start to that moment. The full read catches what `updated_at` does not move, such as a check run finishing on a pull request, and keeps the polled list short.

A change an agent makes reaches the screen within one poll interval. Milky's own taps do not wait, because every POST re-reads. With five repositories, the full reads cost about 60 GraphQL queries an hour and the 304 polls cost nothing, against a 5,000-point hourly limit. UNVERIFIED: whether a 304 still costs secondary-limit points; the server backs off to twice the interval on a secondary-limit response and honours `x-poll-interval` when GitHub sends it.

If agent changes ever feel slow, webhooks can come later through Tailscale Funnel on port 8443 for the one path `/github/webhook`, after testing from outside the tailnet that Funnel exposes nothing else (relayed). Nothing in this design depends on it.

### The GitHub credential

The server holds a **GitHub App** installed on every repository in `DESK_REPOS` and on the desk's own repository, with the private key as a Dokploy file mount (relayed). The server signs a JWT with the key and mints an installation token that lasts one hour, so a leaked token dies within the hour. The App needs Issues write (comments, labels, body edits), Pull requests read, Contents read (the picture proxy and the deploy poll) and Checks read (the done screen).

| | GitHub App (chosen) | Fine-grained token |
|---|---|---|
| Lifetime | one-hour installation tokens from a private key | can be set to never expire |
| Check runs | Checks: read is an App permission | GitHub's docs say fine-grained tokens cannot call the Checks API |
| Comment author | `<app name>[bot]` | Milky |
| Rate limit | 5,000 per hour, rising with the number of repositories | 5,000 per hour, shared with Milky's `gh` |

The comment author changes nothing in the desk's logic: phase 2 tells human from agent by the `<!-- desk:agent -->` marker, never by login. The App's extra setup does not count against it, because setup an agent can do is not a cost (Milky's rule, relayed). Whether "All repositories" covers repositories created later is UNVERIFIED; adding a repository to the installation covers it either way.

### Live updates on the phone

The server pushes one Server-Sent Events stream at `GET /api/events`. When a poll or a POST changes an issue, the server sends an event naming the repository and the issue number. The web app answers an event by invalidating that request's TanStack Query keys and the home query, which refetch from the server.

iOS suspends a backgrounded web app, and on iOS 18 a home-screen app can keep `readyState` OPEN on a dead EventSource with no `error` event (an Apple forum report). WebSocket has the same problem. So the client trusts no open connection:

- The server sends a comment line (`: ping`) every 25 seconds. The client treats 60 seconds without one as a dead stream and replaces the EventSource.
- On `visibilitychange` to visible, `pageshow` and `online`, the client replaces the EventSource and refetches home, because events sent while suspended are gone.
- Events carry `id:` lines, but the server keeps no backlog; the refetch on resume is what catches up.

ntfy still carries the pings, so a suspended app misses nothing that needs Milky.

### Who can call it

The server listens only inside the compose network. The Tailscale sidecar's `tailscale serve` is its only way in, and serve adds `Tailscale-User-Login` to every tailnet request and strips forged copies. The server refuses any request to `/api/*` whose `Tailscale-User-Login` is not `DESK_OWNER_LOGIN`. Requests from tagged devices carry no identity header, so they are refused too.

## 4. The repository and the stack

The desk lives in its own repository (Milky):

```
desk/
├── apps/web/            react-spa template (TanStack Router, TanStack Query, Tailwind v4)
├── apps/api/            hono-api template, db: none, on Bun
├── Dockerfile           builds apps/web, then a Bun image that serves it and runs apps/api
├── docker-compose.yml   desk + tailscale sidecar, for Dokploy
├── .env.example         every key in section 8
└── .milky-kit-version
```

The server is built from **hono-api with a new `db: none` variant and Bun as a runtime** (relayed). The react-spa template's API client imports `createApiClient` from `@<project>/api/client`, which hono-api exports as `hc<AppType>`, so the web app gets a typed client with no generation step. Bun lets the server import the `desk` package's parsers and run its bin directly, since the program's `gh` wrapper calls `Bun.spawn`. hono-api has no database-less variant and no Bun runtime today; T3 adds both to the kit.

The web app uses no variant beyond `ui`: `mobile: none`, because a home-screen web app over Tailscale reaches the phone without a native shell, and `auth: none`, because Tailscale identity replaces a login. The `ui` variant is taste work, chosen by the screen task (section 10).

## 5. Deployment on ceres

### The Dokploy app

A Dokploy **Compose** app named `desk` in the Home project, next to ntfy, built from the desk repository's Dockerfile:

```yaml
services:
  tailscale:
    image: tailscale/tailscale:stable
    hostname: desk
    environment:
      TS_AUTHKEY: ${TS_AUTHKEY}
      TS_STATE_DIR: /var/lib/tailscale
      TS_SERVE_CONFIG: /config/serve.json
    volumes:
      - tailscale-state:/var/lib/tailscale
      - ./tailscale:/config
  desk:
    build: .
    network_mode: service:tailscale
    env_file: .env
    volumes:
      - ./secrets:/run/secrets:ro
volumes:
  tailscale-state:
```

- `serve.json` proxies `desk.<tailnet>.ts.net:443` to `http://127.0.0.1:${PORT}`, tailnet only. Tailscale's docs say to mount the directory, not the file.
- The sidecar gives the desk its own node, so the address is `https://desk.<tailnet>.ts.net`.
- No Traefik route and no published port: Dokploy's proxy is not in the path, so its timeouts do not touch the SSE stream.
- The App's private key is a Dokploy file mount at `/run/secrets/github-app.pem`, because Dokploy documents no rule for multi-line environment values.

### The image

One multi-stage Dockerfile. The build stage runs `pnpm install` (which fetches the private `desk` package from GitHub Packages with a build-time token) and `vite build` for `apps/web`. The runtime stage is `oven/bun` with `gh` installed (the `desk` program shells out to it), the built web files, `apps/api`, and the `desk` package. The server passes its current installation token to every `desk` call as `GH_TOKEN`, which `gh` reads in place of a login.

### Deploying a new version

GitHub Actions is locked on the account by a billing issue, and Milky's projects avoid paid CI, so no deploy runs in an Action (relayed facts). The server deploys itself instead (relayed proposal): every `DESK_DEPLOY_POLL_SECONDS` (default 180) it asks for its own repository's `main` with a conditional `GET /repos/{owner}/{repo}/commits/main`. When the commit differs from the one it was built from (`DESK_BUILD_SHA`, baked into the image), it calls Dokploy's deploy API on ceres with `DOKPLOY_API_KEY`, once per commit. Dokploy then builds from the Dockerfile and replaces the container.

Pressing Deploy in Dokploy stays the fallback, for when the desk itself is broken. UNVERIFIED: the deploy endpoint for a compose app. Dokploy documents `POST /api/application.deploy` for applications, and the compose equivalent must be confirmed before T9 relies on it.

### Publishing the desk package

The same Actions lock means milky-kit cannot publish the `desk` package from CI. T2 adds a `mise run desk:publish` task that bumps the version and runs `pnpm publish` to GitHub Packages from a local machine, with a token that has `write:packages`.

### What Milky provides

1. The new repository (its name waits on the plan's naming question, plan section 11).
2. The GitHub App: created, a private key generated, and installed on every repository in `DESK_REPOS` and on the desk repository.
3. A token with `read:packages` for the image build, and one with `write:packages` on the machine that publishes the `desk` package. UNVERIFIED: whether GitHub Packages' npm registry accepts a fine-grained token, or needs a classic one.
4. On the tailnet: MagicDNS and HTTPS certificates switched on, and a reusable auth key tagged `tag:desk` for the sidecar.
5. In Dokploy: access to the private desk repository, the compose app with the values in section 8, and an API key for the self-deploy.
6. On each coordinator machine, `DESK_APP_URL=https://desk.<tailnet>.ts.net` in `~/.config/desk/.env`.

## 6. New request

The ✏️ box takes one line, a repository and an ask setting. The repository comes from a picker beside the box that defaults to the last one used (relayed). The ask setting defaults to the repository's `ask:` from its `## desk` section, and the request's own `ask:*` label wins over the default (plan section 8).

`POST /api/requests` runs a new command:

```
desk intake --repo <owner>/<repo> --words <file> --ask <ask:*>
```

`desk intake` creates the issue with labels `request,stage:intake,priority:P2,<ask>` and no `autopilot` label, so no build worker claims it. The title is the first 60 characters of the line. The body is:

```markdown
## Your words

<the line, verbatim>

## Decisions

## Small calls
```

`## Your words` is never edited after `desk intake` writes it.

### The frontman

The frontman turns the line into a well-written request (plan section 5): it asks the unclear parts as cards one at a time, says each answer back, and ends with "Is this what you meant?". It runs on Opus at high effort (relayed; [the plan's](plan.md) roles table now matches its routing table).

The project's coordinator dispatches the frontman as an Orca worker (relayed), so it reads the real project with its real tools and every step stays readable from the Issue:

1. **Dispatch.** A new reconcile mismatch, `intake`, fires for an open `request` at `stage:intake` without `proposed`, with no live worker and no open card. The coordinator starts a frontman worker on Opus at high effort.
2. **Claim.** The frontman runs `desk claim <n> --role frontman`, which accepts `stage:intake` and needs no `autopilot` label, and writes `role=frontman` on the claim marker.
3. **Ask.** Each card is a normal `desk park` card, one per park, answered on the desk like any other. `desk answer` sends a request whose owning claim is a frontman's back to `stage:intake`, not `stage:ready`, so the next pass dispatches the frontman again with the answer in hand.
4. **Finish.** When Milky answers "Is this what you meant?" with yes, the frontman rewrites the body below `## Your words` in the house format from [issues.md](../../modules/issues/rules/issues.md) and runs a new `desk ready <n> --points <k>`, which adds `autopilot` and the points label and moves the request to `stage:ready`.

**An accepted proposal** goes through the same frontman (relayed). When the frontman has nothing to ask about a proposal, it skips "Is this what you meant?" and runs `desk ready` at once, because Milky's ✓ already is that confirmation.

**No coordinator running.** The desk shows "waiting for a coordinator" on an intake request that has no frontman claim 10 minutes after it was filed or last answered, so a request never waits silently (relayed). The desk cannot see a coordinator directly; the missing claim is the signal.

## 7. 💬

Plan section 7: 💬 opens a fresh Claude session that reads the request's Issue and branch first, and a decision settled in that chat is written back to the Issue. Milky said "I also like talking to agents through Claude mobile or through Orca". A card's "💬 talk about this first" is the same link with the card's question added to the prompt.

The phone's 💬 aims at a full local session on the Mac, reached from the Claude app (relayed): the Mac is already on whenever coordinators run. Two steps get there:

1. **Built first, as the fallback that works today.** On the phone, 💬 links to `https://claude.ai/code?repositories=<owner>/<repo>&prompt=<text>`, which opens a Claude Code on the web session in the Claude app; the prompt names the issue and the branch, because the link has no branch parameter. A cloud session has none of the Mac's tools and no `desk` program, so it writes back only as an issue comment, if it can (UNVERIFIED). On the Mac, 💬 links to `claude-cli://open?repo=…&q=…`, which opens a local terminal with the prompt.
2. **Tested next.** Whether a command run on the Mac can start a Remote Control session in the request's worktree and print its `claude.ai/code/<id>` link (UNVERIFIED; nothing documented lets a link create one). If it can, a small helper on the coordinator's Mac starts that session when 💬 is tapped, and the phone's 💬 opens it in the Claude app. The helper needs its own design once the test passes.

## 8. Environment variables

`.env.example` in the desk repository lists every key:

```
# Repositories the desk shows, comma-separated owner/name
DESK_REPOS=
# The desk's own repository, polled for self-deploy, as owner/name
DESK_SELF_REPO=
# The Tailscale login allowed to use the API, as the Tailscale admin console shows it
DESK_OWNER_LOGIN=
# The desk's own address, used in 💬 prompts
DESK_APP_URL=
# Port the server listens on inside the compose network
PORT=8092
# GitHub App credential
DESK_GITHUB_APP_ID=
DESK_GITHUB_APP_INSTALLATION_ID=
DESK_GITHUB_APP_PRIVATE_KEY_FILE=/run/secrets/github-app.pem
# optional — seconds between conditional issue polls, default 45
DESK_POLL_SECONDS=
# optional — seconds between full resyncs, default 300
DESK_RESYNC_SECONDS=
# optional — seconds between self-deploy polls, default 180
DESK_DEPLOY_POLL_SECONDS=
# Dokploy on ceres, for self-deploy
DOKPLOY_URL=
DOKPLOY_API_KEY=
DOKPLOY_COMPOSE_ID=
# Tailscale auth key for the sidecar, tagged tag:desk
TS_AUTHKEY=
```

`DESK_BUILD_SHA` is not in the file: the Dockerfile bakes it in from the build's commit. The server refuses to start when a required key is missing, and names it.

`~/.config/desk/.env` on each coordinator machine gains one optional key, read by `desk digest`:

```
# optional — the desk's address; pings link to it instead of a GitHub search
DESK_APP_URL=
```

## 9. Changes to the desk program in milky-kit

Phase 5 needs these in `modules/desk/cli`, because the server must not duplicate a state change the program owns:

| Change | Why |
|---|---|
| `desk intake --words <file> --ask <ask:*>` | a new request from the desk (section 6) |
| `desk accept <n>` and `desk drop <n>` | ✓ start removes `proposed` and leaves `stage:intake`; ✗ drop closes as not planned at `stage:done` |
| `card=<claim>-<k>` on each `desk:decision` marker, written by `desk park` | an answer names the card it answers |
| `desk answer --card <id>` | records one card's answer; requeues only when every card from the newest park is answered; returns a frontman-parked request to `stage:intake` |
| `→ <say-back line>` after each option, in `parking.md` and the card validator | the desk's say-back and the `## Decisions` line |
| `desk claim --role frontman` and `role=` on the claim marker | the frontman claims an intake request |
| `desk ready <n> --points <k>` | the frontman hands a written-up request to the build queue |
| the `intake` reconcile mismatch, in `diff.ts` and the skill's mismatch table | the coordinator dispatches the frontman |
| `desk digest` links to `DESK_APP_URL` when set | pings open the desk |
| a package build of `modules/desk/cli` and `mise run desk:publish` | the desk repository depends on a pinned version |

`desk status --json` already prints the stage, owning claim, attempts, last human comment and pull request; the server uses its own read model instead, so a home screen costs one query per repository, not one process per issue.

## 10. Build split

Models and efforts come from [routing.md](../../skills/desk/reference/routing.md). milky-kit has no `## desk` section, so its review follows the plan's fallback (only where a mistake is both silent and costly). The desk repository gets a `## desk` section in T3 that lists `apps/api/src/github/**` and `apps/api/src/poll/**` as review paths.

| Task | Repository | Owns | Model | Effort | Routing row | Blocked by |
|---|---|---|---|---|---|---|
| T1 desk program changes | milky-kit | section 9 except the package: `intake`, `accept`, `drop`, card ids, `answer --card`, the say-back arrow, `claim --role frontman`, `ready`, the `intake` mismatch, the digest link, and their tests | Sonnet | medium | hard area: the marker grammar and stage moves are the state every coordinator trusts | none |
| T2 publish the desk program | milky-kit | the package build, exported parsers, the `desk` bin, `mise run desk:publish`, the first private release to GitHub Packages | Sonnet | low | easy, no check command for a release | T1 |
| T3 the server template and the repository | milky-kit, then desk | hono-api `db: none` variant and Bun runtime, then `/milky-kit:new` for the desk repository with react-spa, the Dockerfile, `docker-compose.yml`, `.env.example` and the `## desk` section | Sonnet | medium | no pattern to copy for a database-less variant | none |
| T4 read model | desk | `apps/api/src/github/**`: App token minting, GraphQL per repository, parsing through the `desk` package, cache, full resync, the picture proxy, `GET /api/home` and `GET /api/requests/...`, with tests against recorded GraphQL responses | Sonnet | medium | hard area | T2, T3 |
| T5 polling and live updates | desk | `apps/api/src/poll/**` and `/api/events`: conditional polls with ETags, the window start, targeted re-reads, back-off, SSE with heartbeat, the identity check | Sonnet | medium | hard area: async and background work | T4 |
| T6 write endpoints | desk | every POST in section 3, each one `desk` call or one comment followed by a re-read, with tests against a fake `desk` | Sonnet | medium | hard area | T1, T4 |
| T7 screens | desk | `apps/web`: home with QUEUED and Later, one request, the card with its say-back, done-check, overturn, the ✏️ box with the repository picker, the 💬 links, reconnect on resume, the `ui` variant | Opus | medium | taste work: how a screen looks | T4 for reads, T6 for buttons |
| T8 the frontman | milky-kit | the frontman's instructions, its brief in the coordinator skill, and the proposal shortcut | Opus | high | frontman, plans, design talk | T1 |
| T9 deploy on ceres | desk | the Dokploy compose app, the sidecar, the self-deploy poller (`apps/api/src/deploy/**`) after confirming Dokploy's compose deploy endpoint; then Milky's steps in section 5 | Sonnet | low | easy but no check command | T5 |
| T10 Remote Control test | milky-kit | find whether a command starts a Remote Control session in a given worktree and prints its link; record the answer in this doc's section 7 | Sonnet | low | easy but no check command | none |
| T11 end-to-end on the phone | desk | file a request from the phone, answer two cards on one request, "no, because…", then "looks good" and watch the merge, each screen updating without a reload; record it in `docs/end-to-end.md` | Sonnet | medium | no row fits: Sonnet because the steps say what done looks like, medium because a failed step needs diagnosis | every task except T10 |

T1, T3 and T10 start at once. T2 and T8 follow T1. T4 follows T2 and T3; T5 and T6 follow T4 and run side by side; T7 starts on T4's reads and gains its buttons after T6. T9 follows T5. T11 runs last.

## Open

- **The final names** of the desk, the frontman, the label set and the new repository ([the desk plan](plan.md), section 11). Milky has not named them. The working names stand until then, and a rename is one search-and-replace.

## 11. Small calls made in this design

Each line can be overturned.

- Auto-decided: the server parses issues with the `desk` program's pure modules, over its own parser, because two parsers of one marker grammar drift.
- Auto-decided: the server never runs `desk merge`, `desk reopen`, `desk claim`, `desk release` or `desk land`, over calling them directly from the buttons, because phase 2 makes the coordinator the one actor for those, and a second actor would race it.
- Auto-decided: "looks good" and "no, because…" are plain comments, over new commands, because phase 2's reconcile already reads both and runs the right command.
- Auto-decided: pings stay with `desk digest`, over the server sending its own, because two senders would ping one event twice.
- Auto-decided: the server keeps its read model in memory, over a database, because GitHub is the only truth and a restart costs one read per repository.
- Auto-decided: the conditional poll keeps one `since` window until the next full resync, over moving `since` on every poll, because a changing URL never matches the previous ETag and every poll would cost a request.
- Auto-decided: every POST re-reads the issue and returns it, over optimistic updates in the web app, because the screen must show what GitHub holds.
- Auto-decided: Server-Sent Events with a 25-second heartbeat and a forced reconnect on resume, over WebSocket, because the stream runs one way and both transports die the same way when iOS suspends the app.
- Auto-decided: the desk runs as a Tailscale sidecar node named `desk`, over `tailscale serve` on ceres's own node, because it gives the desk its own HTTPS name and needs no host configuration outside Dokploy.
- Auto-decided: the API checks `Tailscale-User-Login` against `DESK_OWNER_LOGIN`, over trusting every tailnet device, because a shared or tagged device would otherwise answer Milky's cards.
- Auto-decided: the desk shows the repositories in `DESK_REPOS`, over every repository the App is installed on, because a repository without labels and a coordinator would show requests nobody works on.
- Auto-decided: the server proxies pictures, over linking to GitHub, because the phone's browser is not logged in to the private repositories.
- Auto-decided: Milky's line goes into `## Your words` and is never edited, over keeping it in the first comment, because the request screen reads it from the body like the other sections, and the frontman rewrites the rest of the body.
- Auto-decided: `desk drop` closes the issue as not planned at `stage:done`, over deleting it, because a dropped proposal stays searchable and the stage rule keeps one stage label on every issue.
- Auto-decided: a frontman's claim carries `role=frontman` and `desk answer` returns its request to `stage:intake`, over a separate frontman stage, because the label set stays as it is and the claim already records who parked the cards.
- Auto-decided: "waiting for a coordinator" appears after 10 minutes without a frontman claim, over reading coordinator state, because the server cannot see Orca or a coordinator's lock file, and 10 minutes matches phase 2's limit for an unclaimed worker.
- Auto-decided: the web app uses `mobile: none` and `auth: none`, over a native shell or Firebase, because a home-screen web app over Tailscale reaches the phone and Tailscale identity replaces a login.

## Relayed proposals, confirmed by Milky

The kansai-2 agent answered this design's cards. Each answer below is the agent's own proposal, or the agent's mechanism for a behaviour the plan settled. Milky confirmed all of them on 2026-10-17 ("all fine").

- **The GitHub App** as the credential, over a fine-grained token.
- **Polling, no webhooks.** This overrides "receives GitHub webhooks" in the brief that started this design, which named webhooks as Milky's decision. Milky confirmed the swap.
- **Card ids and `desk answer --card`**, the mechanism for the plan's one-card-at-a-time answering.
- **The worker writes the say-back line** beside each option; the plan settled only that the line exists.
- **The frontman as an Orca worker** dispatched by the coordinator, and "waiting for a coordinator" when none runs.
- **The frontman at Opus high**, and the plan's roles table changed to match. The agent wrote both of the plan's conflicting rows.
- **A repository picker** beside the ✏️ box.
- **An accepted proposal goes to the frontman**, which skips "Is this what you meant?" when it has nothing to ask; the plan settled only that a proposal starts on ✓.
- **💬 on the phone aims at a Remote Control session on the Mac**, with the web session as the fallback. Milky's quote sets the direction; the mechanism is the agent's.
- **Overturning a small call** as `no, because …` on `stage:check` and a plain comment elsewhere.
- **QUEUED and Later (n)** on home.
- **hono-api with `db: none` on Bun** as the server stack.
- **A private GitHub Packages release** of the `desk` program.
- **Self-deploy by polling `main`.** The facts behind it (GitHub Actions locked by billing, and Milky's avoidance of paid CI) were relayed too.
