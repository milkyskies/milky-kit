# The desk: phase 5 design

Phase 2 put every piece of desk state on GitHub Issues: stages are labels, and claims, cards, results and answers are comments with `<!-- desk:* -->` markers. Today Milky reads that state in the GitHub app and answers with `/decisions` in a terminal. Phase 5 of [the desk plan](plan.md) builds the web app from plan section 3, so Milky never opens GitHub Issues by hand.

The desk is a small server on ceres, deployed with Dokploy and reachable only over Tailscale, next to ntfy at `http://ceres:8091`. The server holds the GitHub credential, so no browser holds a token. It serves the web app, and it receives GitHub webhooks, so the screen changes as soon as an issue does. On the phone, Milky opens the home screen, sees "Counter accents (kansai-2), 2 questions" under NEEDS YOU, taps it, and picks LHL for 三時. The server turns that tap into `desk answer` on the issue, and the project's coordinator picks the request up on its next pass. The desk lives in its own repository.

The desk adds no state of its own. Every screen is a view of labels and markers that phase 2 already defined, and every button is a comment or a `desk` command. The coordinators keep running exactly as phase 2 built them. They never talk to the server, and the server never talks to Orca.

**Status.** Not built. Fourteen questions are open as cards in [Open](#open); the build split in section 10 names which task waits on which card · **Owns.** the desk server's endpoints, its read model and live updates, the mapping from each screen to GitHub reads and writes, the deployment on ceres, and the phase 5 build split

Each call below comes from one of three places:

- **Plan**: settled with Milky in [the desk plan](plan.md).
- **Milky**: stated by Milky in the brief for this design (ceres, Dokploy, Tailscale only, the server holds the credential, webhooks, its own repository).
- **Small call**: decided by this design, listed in section 11 as `Auto-decided: X over Y because Z`, so a reader can overturn it.

Everything else is a card in [Open](#open), and the design text marks the parts that wait on a card.

## 1. The pieces

```
PHONE or MAC (Tailscale on)
   │ https://desk.<tailnet>.ts.net
   ▼
CERES ─ Dokploy compose app "desk"
   ├─ tailscale sidecar: node "desk", serves 443 to the tailnet
   └─ desk server: web app files, /api/*, /api/events (SSE), /github/webhook
          │ GitHub API with the server's credential
          │ `desk` program for every state change
          ▼
       GITHUB ISSUES + LABELS ◄── coordinators and workers (phase 2, unchanged)
          │ webhooks (issues, issue_comment, pull_request, check_suite)
          └──► a public path to /github/webhook (Open: webhook delivery)

ntfy on ceres:8091 ◄── `desk digest` from each coordinator (phase 2, link now opens the desk)
```

- **The server reads GitHub and parses it with the `desk` program's own parsers.** `modules/desk/cli/src/github/` holds the marker grammar, the derived values (owning claim, attempts, last human comment), the body sections and the card validator as pure functions with no I/O (`markers.ts`, `derive.ts`, `body.ts`, `cards.ts`, `parseIssue` in `issue.ts`). The server imports them, so a card means the same thing on the desk as in `desk reconcile`.
- **The server changes state only through `desk` commands, or through a plain comment that a coordinator already knows how to read.** A comment the server posts carries no `<!-- desk:agent -->` marker, because it is Milky's words, and phase 2 treats every unmarked comment as the human's.
- **The server never runs a coordinator command.** `desk claim`, `desk release`, `desk reopen`, `desk merge` and `desk land` stay with the coordinator. "Looks good" is a comment; the coordinator's `looks-good` mismatch then runs `desk merge`.

How the server gets the `desk` program into its image is a card (Open: how the server gets the desk program).

## 2. What each screen reads and writes

The screens are plan section 3. "Open cards" below means the `desk:decision` comments from the newest park on the issue that have no answer yet. Phase 2 has no card id, so phase 5 adds one (Open: several cards on one request).

### Home

One list across every repository in `DESK_REPOS`, sorted by section.

| Section | Reads | Each row shows |
|---|---|---|
| ✏️ I want… | the repository list, and each repository's default ask from its `## desk` section | the input box (section 6) |
| 🔔 NEEDS YOU | open issues with `stage:needs-you` | title, repository, the count of open cards |
| 👀 DONE, CHECK IT | open issues with `stage:check` | title, repository, the first picture in the newest `desk:result` comment |
| 🆕 PROPOSED BY AGENTS | open issues with `proposed` and `stage:intake` | title, repository, the request that proposed it (the `desk:proposed-request issue=<n>` marker on the source issue), and the ✓ start and ✗ drop buttons |
| ⏳ WORKING | open issues with `stage:working` | title, repository, time since the owning claim's `at=` |

Requests at `stage:ready`, `stage:intake` without `proposed`, and `stage:backlog` appear in no section of the plan's home (Open: where waiting requests show). Issues with `bad-labels` (no stage label, or two) show in a line at the bottom, because the digest already reports them and the desk must not hide an issue the coordinator ignores.

Home writes nothing except ✓ start and ✗ drop:

| Button | Runs | What happens next |
|---|---|---|
| ✓ start | `desk accept <n>` (new, section 9) | the request moves on (Open: where an accepted proposal goes) |
| ✗ drop | `desk drop <n>` (new, section 9) | the issue closes as not planned |

### One request

| Part (plan order) | Reads |
|---|---|
| Your own words, verbatim | the body's `## Your words` section, written once by `desk intake` (section 6); for an issue filed another way, the body's `## Problem` |
| Open question cards | the open cards, in the order the worker posted them |
| Decisions so far, with dates | the body's `## Decisions` lines (`- <date>: <decision>`), written by `desk answer` |
| The agent's small calls | the body's `## Small calls` lines, written by `desk note`, each with an overturn control (Open: overturning a small call) |
| Pictures | every image in `desk:result` comments, newest first |
| Requests it spawned | every `desk:proposed-request issue=<n>` marker on the issue, with each target's stage |
| 💬 | a link, section 7 |

The stage, the pull request and the attempt count sit in one line under the title. The full comment thread is one tap away for anything the screen does not render.

### A question card

The card renders the comment's parts: background, `**Already checked:**`, `**Question:**`, the numbered 提案 options, "other…", and "💬 talk about this first". A code-detail card shows its `**Recommendation:**` line. A design card shows its `<details><summary>What would I pick?</summary>` block collapsed, the same way GitHub does, so the pick stays hidden until tapped.

Tapping an option, or typing into "other…", calls `POST /api/requests/:owner/:repo/:n/answers`. The server writes the answer file and runs:

```
desk answer <n> --repo <owner>/<repo> --body <file> --decision "<one line>"
```

The card then says the answer back in one line and shows the next open card (plan). Two parts of that are open: what `desk answer` does while other cards on the same request are still open (Open: several cards on one request), and who writes the one-line say-back (Open: the say-back line).

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
| `POST /api/requests/:owner/:repo/:n/answers` | `{ card, option }` or `{ card, text }` → `desk answer` |
| `POST /api/requests/:owner/:repo/:n/verdict` | `{ verdict: "looks-good" }` or `{ verdict: "no", reason }` → a plain comment |
| `POST /api/requests/:owner/:repo/:n/proposal` | `{ action: "accept" }` or `{ action: "drop" }` → `desk accept` or `desk drop` |
| `POST /api/requests/:owner/:repo/:n/overturn` | waits on the card about overturning a small call |
| `POST /github/webhook` | verifies `X-Hub-Signature-256` against `DESK_GITHUB_WEBHOOK_SECRET`, answers 202 within GitHub's 10-second limit, then refreshes the issue named in the payload |
| `GET /healthz` | 200 when the last resync succeeded within twice the resync interval |

The picture proxy exists because the `desk-pictures` links in result comments point at a private repository, and the phone's browser is not logged in to GitHub. Every POST runs one `desk` command or posts one comment, re-reads the issue, and returns the fresh request, so the screen shows what GitHub holds and never an optimistic guess.

### The read model

The server keeps one in-memory copy of each repository's open issues, filled by the same GraphQL shape `desk reconcile` uses: labels, body, the last 50 comments, and `closedByPullRequestsReferences` with state, draft flag, mergeable state and check rollup.

- **On start**, and every `DESK_RESYNC_SECONDS` (default 300), the server reads every repository in full. GitHub does not redeliver a failed webhook, so the resync is what catches a delivery lost while ceres was down.
- **On a webhook**, the server re-reads only the issue the payload names, and for a `pull_request` or `check_suite` event the issues that pull request closes.
- **Duplicate deliveries** are dropped by `X-GitHub-Delivery` id, kept for an hour.
- Nothing is written to disk. A restart costs one full read.

With five repositories, the resync costs about 60 GraphQL queries an hour, against a 5,000-point hourly limit.

### The GitHub credential

The server needs Issues write (comments, labels, body edits), Pull requests read, Contents read (the picture proxy) and Checks read (the done screen). Two kinds of credential can hold that, and the choice is open (Open: the GitHub credential).

| | GitHub App | Fine-grained personal access token |
|---|---|---|
| Lifetime | the server signs a JWT with the App's private key and mints an installation token that lasts one hour | can be set to never expire (`expires_in: none`); GitHub removes a token unused for a year |
| A leaked token | dies within the hour; the private key is the long-lived secret | works until revoked |
| Webhooks | one webhook URL in the App's settings, for every repository the App is installed on | one webhook per repository, created by the server or by hand (`POST /repos/{owner}/{repo}/hooks`, needs Webhooks: write) |
| A new repository | add it to the installation (whether "All repositories" covers later ones is UNVERIFIED) | edit the token's repository list, and create its webhook |
| Check runs | Checks: read is an App permission | GitHub's docs say fine-grained tokens cannot call the Checks API; whether the GraphQL check rollup works is UNVERIFIED |
| Comment author | `<app name>[bot]`; posting as Milky needs a user-to-server token (8 hours, refreshed for 6 months) and a login flow | Milky |
| Rate limit | 5,000 per hour, rising with the number of repositories | 5,000 per hour, shared with Milky's `gh` |
| Setup | create the App, generate a key, install it | create the token |

The comment author changes nothing in the desk's logic: phase 2 tells human from agent by the `<!-- desk:agent -->` marker, never by login, because workers already post with Milky's own login.

### Webhooks to a Tailscale-only host

GitHub cannot reach ceres, so a webhook needs a public path to `/github/webhook`. Which path is open (Open: webhook delivery). Whatever the choice, the server checks the signature on every delivery, and the resync covers any delivery that never arrives.

| Path | How it works | Public exposure | Cost and caveats |
|---|---|---|---|
| Tailscale Funnel | the desk's own Tailscale node funnels one path on one port to the server | `https://desk.<tailnet>.ts.net:8443/github/webhook`, signature-checked | free on every plan, beta, needs the `funnel` node attribute. Funnel is switched on per host and port, so the web app on 443 stays tailnet-only only when the webhook uses another port such as 8443 (reading of Tailscale's serve config; UNVERIFIED). The hostname appears in certificate transparency logs |
| A Cloudflare Worker with a Queue | GitHub posts to a Worker, the Worker enqueues it, the server pulls and acknowledges | only the Worker | a Cloudflare account; free plan keeps messages 24 hours and allows 10,000 operations a day (about 3,300 deliveries); one more deployable |
| Cloudflare Tunnel | `cloudflared` on ceres opens an outbound tunnel to a public hostname routed to the webhook path | the routed hostname | needs a domain on Cloudflare; pricing UNVERIFIED |
| smee.io | GitHub posts to a smee channel, a client on ceres reads it over SSE | the channel, unauthenticated: anyone with its id reads every payload, which carries private issue text | smee's own README says it is not for production; a delivery made while the client is down is lost |

`gh webhook forward` is left out: GitHub documents it as testing-only, and only one forwarder runs per repository.

### Live updates on the phone

The server pushes one Server-Sent Events stream at `GET /api/events`. Each event names a repository and an issue number. The web app answers an event by invalidating that request's TanStack Query keys and the home query, which refetch from the server.

iOS suspends a backgrounded web app, and on iOS 18 a home-screen app can keep `readyState` OPEN on a dead EventSource with no `error` event (an Apple forum report). WebSocket has the same problem. So the client trusts no open connection:

- The server sends a comment line (`: ping`) every 25 seconds. The client treats 60 seconds without one as a dead stream and replaces the EventSource.
- On `visibilitychange` to visible, `pageshow` and `online`, the client replaces the EventSource and refetches home, because events sent while suspended are gone.
- Events carry `id:` lines, but the server keeps no backlog; the refetch on resume is what catches up.

ntfy still carries the pings, so a suspended app misses nothing that needs Milky.

### Who can call it

The server listens only inside the compose network. The Tailscale sidecar's `tailscale serve` is its only way in, and serve adds `Tailscale-User-Login` to every tailnet request and strips forged copies. The server refuses any `/api/*` request whose `Tailscale-User-Login` is not `DESK_OWNER_LOGIN`. Requests from tagged devices and from Funnel carry no identity header, so they are refused too, which keeps a Funnel webhook path from reaching the API. `/github/webhook` is the one route that needs no identity, because it checks the signature instead.

## 4. The repository and the stack

The desk lives in its own repository (Milky). Its layout, assuming the stack card's recommendation:

```
desk/
├── apps/web/            react-spa template (TanStack Router, TanStack Query, Tailwind v4)
├── apps/api/            the server (Open: the server stack)
├── Dockerfile           builds apps/web, then a Bun image that serves it and runs apps/api
├── docker-compose.yml   desk + tailscale sidecar, for Dokploy
├── .env.example         every key in section 8
└── .milky-kit-version
```

The react-spa template's API client imports `createApiClient` from `@<project>/api/client`, which the hono-api template exports as `hc<AppType>`, so a Hono server gives the web app a typed client with no generation step. hono-api has no variant without a database today (`db` is `d1`, `neon` or `supabase`) and runs on Workers or Node, while the `desk` parsers are Bun TypeScript. effect-api needs Postgres. bun-scripts has no HTTP server. Which server stack to use is open (Open: the server stack).

The web app uses no variant beyond `ui`: `mobile: none`, because a home-screen web app over Tailscale reaches the phone without a native shell, and `auth: none`, because Tailscale identity replaces a login. The `ui` variant is taste work, chosen by the screen task (section 10).

## 5. Deployment on ceres

### The Dokploy app

A Dokploy **Compose** app named `desk` in the Home project, next to ntfy:

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

- `serve.json` proxies `desk.<tailnet>.ts.net:443` to `http://127.0.0.1:${PORT}`. A Funnel entry for port 8443 and the path `/github/webhook` is added only if the webhook card picks Funnel. Tailscale's docs say to mount the directory, not the file.
- The sidecar gives the desk its own node, so the address is `https://desk.<tailnet>.ts.net` and ceres's own node never carries a Funnel.
- No Traefik route and no published port: Dokploy's proxy is not in the path, so its timeouts do not touch the SSE stream.
- The App's private key, if the credential card picks an App, is a Dokploy file mount at `/run/secrets/github-app.pem`, because Dokploy documents no rule for multi-line environment values.

### The image

One multi-stage Dockerfile: a build stage runs `pnpm install` and `vite build` for `apps/web`; the runtime stage is `oven/bun` with `gh` installed (the `desk` program shells out to it), the built web files, `apps/api`, and the `desk` program (Open: how the server gets the desk program). The server passes its current installation token, or the fine-grained token, to every `desk` call as `GH_TOKEN`, which `gh` reads in place of a login.

### Deploying a new version

Dokploy's auto-deploy on push is a webhook from GitHub to the Dokploy instance, which a Tailscale-only ceres cannot receive. How a new version reaches ceres is open (Open: the deploy trigger).

### What Milky provides

1. The new repository (its name waits on the plan's naming question, plan section 11).
2. The GitHub credential, per the credential card, and its installation on every repository in `DESK_REPOS`.
3. A webhook secret: `openssl rand -hex 32`, saved in the App's webhook settings or in each repository webhook, and in the server's `.env`.
4. On the tailnet: MagicDNS and HTTPS certificates switched on; a reusable auth key tagged `tag:desk` for the sidecar; and the `funnel` node attribute for `tag:desk` if the webhook card picks Funnel.
5. The webhook relay's account, if the webhook card picks Cloudflare.
6. The Dokploy compose app with the values in section 8.
7. On each coordinator machine, `DESK_APP_URL=https://desk.<tailnet>.ts.net` in `~/.config/desk/.env`.

## 6. New request

The ✏️ box takes one line, a repository and an ask setting. The ask setting defaults to the repository's `ask:` from its `## desk` section, and the request's own `ask:*` label wins over the default (plan section 8). Which repository a line goes to is open (Open: which project a new request goes to).

`POST /api/requests` runs a new command:

```
desk intake --repo <owner>/<repo> --words <file> --ask <ask:*>
```

`desk intake` creates the issue with labels `request,stage:intake,priority:P2,<ask>` and no `autopilot` label, so nothing claims it. The title is the first 60 characters of the line. The body is:

```markdown
## Your words

<the line, verbatim>

## Decisions

## Small calls
```

The frontman then turns the line into a well-written request (plan section 5): it asks the unclear parts as cards inside the new request, one at a time, says each answer back, and ends with "Is this what you meant?". Each card is a normal `desk park` card, answered on the desk like any other. When Milky answers yes, the frontman rewrites the body below `## Your words` in the house format from [issues.md](../../modules/issues/rules/issues.md), adds the `autopilot` and `points:*` labels, and the request moves to `stage:ready` for the coordinator.

Where the frontman runs is open (Open: where the frontman runs), and the plan gives it two efforts (Open: the frontman's effort). `## Your words` is never edited after `desk intake` writes it.

## 7. 💬

Plan section 7: 💬 opens a fresh Claude session that reads the request's Issue and branch first, and a decision settled in that chat is written back to the Issue. The button needs no server state; it is a link built from the issue. A card's "💬 talk about this first" is the same link with the card's question added to the prompt.

What the link opens is open (Open: 💬 on the phone). Two facts constrain it:

- Claude Code on the web takes `https://claude.ai/code?repositories=<owner>/<repo>&prompt=<text>` (documented), and on a phone `claude.ai/code` links open in the Claude app. It has no branch parameter, so the prompt names the branch. A cloud session clones from GitHub and has none of the Mac's tools: no Serena, no local database, no `~/.claude/kit`, so it cannot run `desk answer`. Whether it can comment on the issue is UNVERIFIED.
- `claude-cli://open?repo=…&q=…` prefills a prompt in a terminal on the machine where the link is clicked, so it works on the Mac and never on the phone. Remote Control sessions show in the phone app, but nothing documented lets a link create one, and Orca has no documented URL that opens a worktree or terminal.

## 8. Environment variables

`.env.example` in the desk repository lists every key:

```
# Repositories the desk shows, comma-separated owner/name
DESK_REPOS=
# The Tailscale login allowed to use the API, as the Tailscale admin console shows it
DESK_OWNER_LOGIN=
# The desk's own address, used in 💬 prompts
DESK_APP_URL=
# Port the server listens on inside the compose network
PORT=8092
# Secret shared with GitHub's webhook settings
DESK_GITHUB_WEBHOOK_SECRET=
# GitHub App credential (if the credential card picks an App)
DESK_GITHUB_APP_ID=
DESK_GITHUB_APP_INSTALLATION_ID=
DESK_GITHUB_APP_PRIVATE_KEY_FILE=/run/secrets/github-app.pem
# Fine-grained token (if the credential card picks a token)
DESK_GITHUB_TOKEN=
# optional — seconds between full resyncs, default 300
DESK_RESYNC_SECONDS=
# Tailscale auth key for the sidecar, tagged tag:desk
TS_AUTHKEY=
```

The server refuses to start when a required key is missing, and names it. The credential keys not picked by the credential card are deleted from the file once the card is answered.

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
| `desk accept <n>` and `desk drop <n>` | the ✓ start and ✗ drop buttons. `drop` closes the issue as not planned and moves it to `stage:done`. What `accept` moves waits on its card |
| A card id on `desk:decision` markers, and `desk answer --card <id>` | the desk answers one card of several (Open: several cards on one request) |
| `desk digest` links to `DESK_APP_URL` when set | pings open the desk |
| A reconcile mismatch for the frontman | only if the frontman card puts the frontman under the coordinator |
| Publish the program so the server can depend on it | waits on its card |

`desk status --json` already prints the stage, owning claim, attempts, last human comment and pull request; the server uses its own read model instead, so a home screen costs one GraphQL query per repository, not one process per issue.

## 10. Build split

Models and efforts come from [routing.md](../../skills/desk/reference/routing.md). milky-kit has no `## desk` section, so its review follows the plan's fallback (only where a mistake is both silent and costly); the desk repository gets a `## desk` section in T3 that lists `apps/api/src/github/**` and `apps/api/src/webhook/**` as review paths.

| Task | Repository | Owns | Model | Effort | Routing row | Waits on |
|---|---|---|---|---|---|---|
| T1 desk program changes | milky-kit | section 9: `intake`, `accept`, `drop`, card ids and `answer --card`, the digest link, the frontman mismatch if any, and their tests | Sonnet | medium | hard area: the marker grammar and stage moves are the state every coordinator trusts | cards: several cards on one request, where an accepted proposal goes, where the frontman runs, the say-back line |
| T2 publish the desk program | milky-kit | whatever the card picks: a package build and release workflow, or nothing | Sonnet | low | easy, no check command for a release | card: how the server gets the desk program |
| T3 the server template and the repository | milky-kit, then desk | a server stack per its card (for hono-api, a `db: none` variant on Bun), then `/milky-kit:new` for the desk repository with react-spa, the Dockerfile, `docker-compose.yml`, `.env.example`, CI and the `## desk` section | Sonnet | medium | no pattern to copy for a database-less variant | card: the server stack |
| T4 read model | desk | `apps/api/src/github/**`: credential, GraphQL per repository, parsing through the desk program's modules, cache, resync, the picture proxy, `GET /api/home` and `GET /api/requests/...`, with tests against recorded GraphQL responses | Sonnet | medium | hard area | T2, T3, card: the GitHub credential |
| T5 webhooks and live updates | desk | `apps/api/src/webhook/**` and `/api/events`: signature check, delivery dedupe, targeted refresh, SSE with heartbeat, the identity check | Sonnet | medium | hard area: async and background work | T4, card: webhook delivery |
| T6 write endpoints | desk | every POST in section 3, each one `desk` call or one comment followed by a re-read, with tests against a fake `desk` | Sonnet | medium | hard area | T1, T4 |
| T7 screens | desk | `apps/web`: home, one request, the card, done-check, the ✏️ box, the 💬 link, reconnect on resume, the `ui` variant | Opus | medium | taste work: how a screen looks | T4 for reads, T6 for buttons, cards: 💬 on the phone, overturning a small call, where waiting requests show |
| T8 the frontman | milky-kit | the frontman's instructions and how it is started, per its card | Opus | high | frontman, plans, design talk | cards: where the frontman runs, the frontman's effort |
| T9 deploy on ceres | desk | the Dokploy compose app, the sidecar, the webhook path, the deploy trigger; then Milky's steps in section 5 | Sonnet | low | easy but no check command | T5, cards: webhook delivery, the deploy trigger |
| T10 end-to-end on the phone | desk | file a request from the phone, answer two cards on one request, "no, because…", then "looks good" and watch the merge, each screen updating without a reload; record it in `docs/end-to-end.md` | Sonnet | medium | no row fits: Sonnet because the steps say what done looks like, medium because a failed step needs diagnosis | every task |

T1, T2 and T3 start side by side once their cards are answered. T4 follows T2 and T3; T5 and T6 follow T4 and run side by side; T7 starts on T4's reads and gains its buttons after T6. T8 needs only T1. T10 runs last.

## Open

Each card is one decision: background, then the question, then proposals. A code-detail card carries its recommendation. A design card hides the pick until tapped.

### The GitHub credential

**Kind:** code-detail

The server needs Issues write, Pull requests read, Contents read and Checks read on every repository in `DESK_REPOS`. A GitHub App mints one-hour installation tokens from a private key, has one webhook for every installed repository, can read check runs, and posts comments as `<app name>[bot]`. A fine-grained token can be set to never expire, posts as Milky, needs one webhook per repository, and cannot call the Checks API, so the done screen would show check state only if the GraphQL rollup works with it (UNVERIFIED). The desk's logic is the same either way, because phase 2 tells human from agent by marker, not by login.

**Already checked:** GitHub's docs on token lifetime, rate limits, App webhooks, fine-grained permissions and the Checks API restriction (section 3 table).

**Question:** Which credential does the server hold?

**Options:**
1. 提案 A GitHub App installed on the desk's repositories, with the private key as a Dokploy file mount - one webhook setting, check runs readable, a leaked token dies within an hour; Milky's answers appear as `<app name>[bot]` on GitHub.
2. 提案 A fine-grained token with no expiry - one secret, answers appear as Milky; a webhook per repository, no check runs, and a leaked token works until revoked.

**Recommendation:** A GitHub App installed on the desk's repositories, with the private key as a Dokploy file mount.

### Webhook delivery

**Kind:** design

GitHub cannot reach ceres. A webhook needs a public path, and every option in section 3 exposes something to the internet or adds an account. The server checks each delivery's signature, and the five-minute resync covers a delivery that never arrives, so a lost delivery delays the screen by up to five minutes and loses nothing.

**Already checked:** Tailscale Funnel's docs (ports 443, 8443, 10000; all plans; beta), Cloudflare Queues pull consumers and pricing, smee.io's README, `gh webhook forward`'s docs (testing only).

**Question:** Which path brings GitHub's webhooks to the desk server?

**Options:**
1. 提案 Tailscale Funnel on the desk's own node, port 8443, path `/github/webhook` only - free, nothing new to deploy; the desk node's hostname becomes publicly reachable on that port.
2. 提案 A Cloudflare Worker that queues deliveries, with the server pulling them - ceres stays fully private and deliveries wait up to 24 hours while ceres is down; a Cloudflare account and one more deployable.
3. 提案 Cloudflare Tunnel to a hostname on a Cloudflare domain - a public hostname routed to the webhook path; needs a domain on Cloudflare.
4. 提案 smee.io - nothing to run but a client; anyone with the channel id reads every payload, including private issue text.

<details><summary>What would I pick?</summary>

Tailscale Funnel on the desk's own node, port 8443, path `/github/webhook` only. The resync already covers ceres being down, so the queue's retention buys little, and Funnel adds no account and no deployable. Funnel scoping to one port and path is UNVERIFIED and needs a test from outside the tailnet before the App's webhook is pointed at it.

</details>

### Several cards on one request

**Kind:** code-detail

`desk park` can post several cards at once, and every card from one park carries the same `claim=` value; there is no card id. `desk answer` moves the request from `stage:needs-you` to `stage:ready` after the first answer, whatever other cards are still open (`modules/desk/cli/src/commands/answer.ts:43-52`). On the desk, answering the first of two cards would requeue the request before the second is answered, and the next worker would park the second card again.

**Already checked:** `answer.ts`, `park.ts:63-65`, `cards.ts` and the parking reference.

**Question:** How does `desk answer` handle a request with more than one open card?

**Options:**
1. 提案 `desk park` writes `card=<claim>-<k>` on each card marker; `desk answer --card <id>` records the answer and appends to `## Decisions`, and moves the stage to `stage:ready` only when every card from the newest park has an answer - the desk answers cards one at a time, and the request requeues once.
2. 提案 The desk collects every answer locally and calls `desk answer` once with all of them in one body and one decision line each - no program change beyond repeating `--decision`; an answer typed on the phone is lost if the app closes before the last card.

**Recommendation:** `desk park` writes `card=<claim>-<k>` on each card marker, and `desk answer --card <id>` moves the stage only when every card from the newest park has an answer.

### The say-back line

**Kind:** design

After an answer, the plan's card "says it back in one line ('三時 = LHL. 〜時 follows 三')". The line also becomes the `## Decisions` entry, through `desk answer --decision`. The example's second half ("〜時 follows 三") is a consequence that only someone who knows the request could write. The server has no model.

**Already checked:** plan section 3, `desk answer`'s flags, and the card template in `modules/desk/reference/parking.md`.

**Question:** Who writes the one-line say-back for an answer?

**Options:**
1. 提案 The worker writes a say-back line beside each option when it parks the card (a new `→ <line>` after each option), and the desk uses the chosen option's line - the line carries the consequence; every card gets longer, and "other…" answers fall back to the typed text.
2. 提案 The server writes `<question>: <chosen option>` mechanically - no change to cards; the line never carries a consequence.
3. 提案 The server calls a model to write the line from the card and the answer - the line reads like the plan's example; the server then holds an Anthropic credential and costs tokens on every answer.

<details><summary>What would I pick?</summary>

The worker writes a say-back line beside each option when it parks the card. The worker is the only party that already holds the context when the card is written, so the line costs no extra model call, and the line Milky sees is the line that goes into `## Decisions`.

</details>

### Where the frontman runs

**Kind:** design

The plan's frontman turns the ✏️ line into a well-written request by asking cards one at a time. The coordinators ignore `stage:intake` today, and the server on ceres has no Orca, no project checkout and no Anthropic credential. A frontman needs to read the project to ask good questions.

**Already checked:** plan sections 4 and 5, `classifyIssue` in `modules/desk/cli/src/reconcile/diff.ts` (intake is ignored), the skill's mismatch table.

**Question:** Where does the frontman run for a request filed from the desk?

**Options:**
1. 提案 The project's coordinator dispatches it as an Orca worker through a new `intake` mismatch, and re-dispatches it after each answer until "Is this what you meant?" is answered yes - it reads the real project with its tools; the first card waits for the coordinator's next pass (the watchdog polls GitHub once a minute) and needs the coordinator running.
2. 提案 The desk server runs it with the Claude Agent SDK against a checkout of the repository on ceres - the first card can arrive in seconds without a coordinator; ceres then holds an Anthropic credential and a checkout per project, with none of the Mac's MCP servers.
3. 提案 The desk only files the issue at `stage:intake`, and Milky starts the frontman through 💬 - nothing new to build; the request waits until Milky opens a session.

<details><summary>What would I pick?</summary>

The project's coordinator dispatches it as an Orca worker through a new `intake` mismatch. It keeps the server free of a model credential, the frontman sees the project the same way the request agent will, and every step stays an Issue comment a fresh coordinator can read back.

</details>

### The frontman's effort

**Kind:** code-detail

The plan gives the frontman two efforts: the roles table in section 4 says "Opus, medium", and the routing table in section 8 (and `skills/desk/reference/routing.md`) says Opus at high for "Frontman, plans, design talk, explorations".

**Already checked:** plan sections 4 and 8, `routing.md`.

**Question:** Which effort does the frontman run at?

**Options:**
1. 提案 Opus at high, and the roles table changes to match - the frontman writes the request every later worker builds from.
2. 提案 Opus at medium, and the routing row splits the frontman from plans and explorations - each new request costs less; the frontman runs on every request.

**Recommendation:** Opus at high, and the roles table changes to match.

### Which project a new request goes to

**Kind:** design

The ✏️ box sits on a home screen that lists every project. The plan does not say how a line reaches one repository. A request filed in the wrong repository has to be transferred, which GitHub supports between repositories of the same owner.

**Already checked:** plan sections 3 and 5.

**Question:** How does a line typed in the ✏️ box reach a repository?

**Options:**
1. 提案 A repository picker beside the box, defaulting to the last one used - one tap more per request; nothing is guessed.
2. 提案 The frontman infers the repository from the line, and asks a card when it cannot tell - one sentence is enough; a wrong guess is a transfer later, and the request needs a home before the frontman runs, so it starts in an inbox repository.
3. 提案 Every line goes to one inbox repository, and the frontman transfers the issue once the request is clear - the box stays one line; every request is filed twice in GitHub's history.

<details><summary>What would I pick?</summary>

A repository picker beside the box, defaulting to the last one used. The other two need an inbox repository and a transfer step, and both put a guess between Milky's sentence and the request's home.

</details>

### Where an accepted proposal goes

**Kind:** design

A proposed request is filed by `desk propose` with `request,proposed,stage:intake` and only a required `## Problem` section: no acceptance criteria, no tests, no `autopilot`. The plan says it "starts only on your ✓". A worker given only a problem statement is likely to park with a proposed body.

**Already checked:** `propose.ts`, the issue body rules in `issues.md`, the plan's proposed-request rows.

**Question:** What does ✓ start do to a proposed request?

**Options:**
1. 提案 It removes `proposed` and leaves the request at `stage:intake`, so the frontman writes it up the same way as a request from the ✏️ box - one path for every new request; it waits for the frontman's cards.
2. 提案 It removes `proposed`, adds `autopilot`, and moves the request to `stage:ready` - work starts on the next pass; an underspecified body comes back as a parked card with a proposed body.

<details><summary>What would I pick?</summary>

It removes `proposed` and leaves the request at `stage:intake` for the frontman. An agent's side topic is written for the agent that found it, and the frontman is the step that turns any request into one Milky has confirmed.

</details>

### 💬 on the phone

**Kind:** design

💬 opens a fresh Claude session that reads the request's Issue and branch (plan section 7). On the phone, a `claude.ai/code?repositories=…&prompt=…` link opens a cloud session in the Claude app, which has none of the Mac's tools and no `desk` program. On the Mac, a `claude-cli://open` link opens a local terminal with the prompt. No documented link starts a Remote Control session or opens an Orca worktree.

**Already checked:** Claude Code's web quickstart, deep links, mobile and Remote Control docs; Orca's CLI docs and its `orca://` handler, which only handles skill shares and pairing.

**Question:** What does 💬 open?

**Options:**
1. 提案 On the phone, a Claude Code on the web session on the repository with a prompt naming the issue and branch; on the Mac, a `claude-cli://open` link in the repository - works anywhere today; the phone session cannot run `desk answer`, so a decision settled there reaches the Issue only as a comment it writes, if it can (UNVERIFIED).
2. 提案 The desk shows the prompt with a copy button, and Milky pastes it into whichever session is at hand - nothing can break; one extra step every time.
3. 提案 A small helper on the coordinator's Mac starts a Remote Control session in the request's worktree when 💬 is tapped, and the desk links to it - the full local toolset from the phone; a new always-on process on the Mac, and the Mac must be awake.

<details><summary>What would I pick?</summary>

On the phone, a Claude Code on the web session; on the Mac, a `claude-cli://open` link. Both exist today, and the Remote Control helper can follow if the cloud session turns out unable to write back. The first test is whether a cloud session can comment on a private issue.

</details>

### Overturning a small call

**Kind:** design

Each small call is overturnable from the request screen (plan sections 3 and 4). A small call is one line in `## Small calls`, written by `desk note`. Phase 2 reads a human comment differently by stage: on `stage:check` a comment that is not `looks good` or `no …` is a `conversation`, sent to a reply-only worker that changes no code; on `stage:working` the live worker reads new comments ("the latest comment wins").

**Already checked:** the reconcile table in [phase 2](phase-2.md) section 4, `desk note`, the worker rule.

**Question:** What does overturning a small call do?

**Options:**
1. 提案 On `stage:check` it posts `no, because <the small call> should be <Milky's text>`, which reopens the request; on any other stage it posts the same text as a plain comment the worker reads - reuses both existing paths; an overturn on a finished request always means another build.
2. 提案 It posts a comment with an `overturn` marker that a new reconcile mismatch sends back to the request's worker at any stage - one meaning everywhere; a new marker and mismatch in the desk program.

<details><summary>What would I pick?</summary>

On `stage:check` it posts a `no, because …` comment, and elsewhere a plain comment. Overturning a call on a finished request does mean the code must change, which is what a reopen already does.

</details>

### Where waiting requests show

**Kind:** design

The plan's home has four sections: NEEDS YOU, DONE CHECK IT, PROPOSED BY AGENTS and WORKING. A request at `stage:ready` (queued, or waiting for a free worker), at `stage:intake` while the frontman works, or at `stage:backlog` fits none of them. Without a place, a request Milky just answered disappears from home until a worker claims it.

**Already checked:** plan section 3, the stage list in `issues.md`.

**Question:** Where do requests at `stage:ready`, `stage:intake` and `stage:backlog` show?

**Options:**
1. 提案 `stage:ready` and `stage:intake` rows show at the bottom of WORKING, marked "queued"; `stage:backlog` shows nowhere on home - nothing Milky just touched disappears; WORKING mixes running and waiting work.
2. 提案 A fifth section, QUEUED, below WORKING, for `stage:ready` and `stage:intake`; backlog shows nowhere on home - the plan's four sections stay as they are; one more section to scan.
3. 提案 None of them show on home; a search screen lists every request by stage - home stays as the plan draws it; a just-answered request leaves home until it is claimed.

<details><summary>What would I pick?</summary>

A fifth section, QUEUED, below WORKING. The plan's top sections stay untouched, and the bottom of home is where nothing needs Milky.

</details>

### The server stack

**Kind:** code-detail

The react-spa template's API client expects a Hono `AppType` from `@<project>/api/client`. hono-api has no variant without a database and runs on Workers or Node. effect-api needs Postgres and runs on Bun. bun-scripts has no HTTP server. The `desk` program is Bun TypeScript, and its `gh` wrapper calls `Bun.spawn`, so the server can import its parsers and run its commands most simply on Bun. Hono runs on Bun.

**Already checked:** each template's README and `module.toml`, `templates/react-spa/scaffold/apps/{{app_name}}/src/services/api/client.ts`, `modules/desk/cli/src/github/gh.ts`.

**Question:** Which milky-kit template is the server built from?

**Options:**
1. 提案 hono-api, with a new `db: none` variant and Bun as a runtime - the react-spa client is typed against it with no generation step; a new variant and runtime in the kit.
2. 提案 effect-api with the database removed - the most capable template; removing Postgres touches its migrate script, Dockerfile and layers, and the react-spa client has no Effect client today.
3. 提案 bun-scripts plus `Bun.serve` by hand - the least code; no typed client, and no template to keep the server aligned with.

**Recommendation:** hono-api, with a new `db: none` variant and Bun as a runtime.

### How the server gets the desk program

**Kind:** code-detail

The server parses issues with the `desk` program's modules and changes state by running `desk` commands. Today the program reaches machines only as `~/.claude/kit/modules/desk/bin/desk`, a path into a milky-kit checkout, which a container on ceres does not have. The desk repository must pin the version it runs, so a kit change cannot alter the desk's reading of a card without a deploy.

**Already checked:** `modules/desk/bin/desk`, `modules/desk/cli/package.json`, the `github/` modules' imports.

**Question:** How does the desk repository depend on the desk program?

**Options:**
1. 提案 Publish `modules/desk/cli` as a package with a `desk` bin and exported parsers, and add it to the server with `pnpm add` - a versioned dependency that upgrades like any other; a release step in milky-kit.
2. 提案 Clone milky-kit at a pinned commit in the Dockerfile - no release step; the pin is a build argument nobody's dependency tooling sees, and local development needs its own checkout.
3. 提案 A git submodule of milky-kit in the desk repository - pinned in git; every clone and CI run must init the submodule.

**Recommendation:** Publish `modules/desk/cli` as a package with a `desk` bin and exported parsers.

### The deploy trigger

**Kind:** code-detail

Dokploy's auto-deploy is a webhook from GitHub to Dokploy, which cannot reach a Tailscale-only ceres. Dokploy also has a deploy API (`POST /api/application.deploy` with an API key), and GitHub Actions can join a tailnet as an ephemeral tagged node through Tailscale's action.

**Already checked:** Dokploy's auto-deploy, Docker source and variables docs; Tailscale's GitHub Action docs.

**Question:** How does a new version of the desk reach ceres?

**Options:**
1. 提案 Milky presses Deploy in Dokploy, which builds from the repository's Dockerfile - nothing to set up; every release needs a visit to Dokploy.
2. 提案 A GitHub Action on `main` builds the image to GHCR, joins the tailnet, and calls Dokploy's deploy API - deploys on every merge; a Tailscale OAuth client and a Dokploy API key stored as repository secrets.
3. 提案 The desk server receives `push` events for its own repository and calls Dokploy's deploy API on ceres - no new secrets in GitHub; a broken desk cannot deploy its own fix, so pressing Deploy stays the fallback.

**Recommendation:** A GitHub Action on `main` builds the image to GHCR, joins the tailnet, and calls Dokploy's deploy API.

### Names

The final names of the desk, the frontman, and the label set stay open in [the desk plan](plan.md), section 11. The new repository's name waits on the same answer.

## 11. Small calls made in this design

Each line can be overturned.

- Auto-decided: the server parses issues with the `desk` program's pure modules, over its own parser, because two parsers of one marker grammar drift, and the brief rules out duplicating the desk commands.
- Auto-decided: the server never runs `desk merge`, `desk reopen`, `desk claim`, `desk release` or `desk land`, over calling them directly from the buttons, because phase 2 makes the coordinator the one actor for those, and a second actor would race it.
- Auto-decided: "looks good" and "no, because…" are plain comments, over new commands, because phase 2's reconcile already reads both and runs the right command.
- Auto-decided: pings stay with `desk digest`, over the server sending its own, because two senders would ping one event twice.
- Auto-decided: the server keeps its read model in memory and resyncs every five minutes, over a database, because GitHub is the only truth and a restart costs one read per repository.
- Auto-decided: every POST re-reads the issue and returns it, over optimistic updates in the web app, because the screen must show what GitHub holds.
- Auto-decided: Server-Sent Events with a 25-second heartbeat and a forced reconnect on resume, over WebSocket, because the stream runs one way and both transports die the same way when iOS suspends the app.
- Auto-decided: the desk runs as a Tailscale sidecar node named `desk`, over `tailscale serve` on ceres's own node, because it gives the desk its own HTTPS name, keeps any Funnel off ceres's node, and needs no host configuration outside Dokploy.
- Auto-decided: the API checks `Tailscale-User-Login` against `DESK_OWNER_LOGIN`, over trusting every tailnet device, because a shared or tagged device would otherwise answer Milky's cards.
- Auto-decided: the desk shows the repositories in `DESK_REPOS`, over every repository the credential can see, because a repository without labels and a coordinator would show requests nobody works on.
- Auto-decided: the server proxies pictures, over linking to GitHub, because the phone's browser is not logged in to the private repositories.
- Auto-decided: Milky's line goes into `## Your words` and is never edited, over keeping it in the first comment, because the request screen reads it from the body like the other sections, and the frontman rewrites the rest of the body.
- Auto-decided: `desk drop` closes the issue as not planned at `stage:done`, over deleting it, because a dropped proposal stays searchable and the stage rule keeps one stage label on every issue.
- Auto-decided: the web app uses `mobile: none` and `auth: none`, over a native shell or Firebase, because a home-screen web app over Tailscale reaches the phone and Tailscale identity replaces a login.
