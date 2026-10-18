# Setting up frontdesk on a machine and a project

Follow this to run frontdesk on a new machine (for example zeus) and to add a project to it. It is written for an agent; every step is a command or a file edit. Ask Milky only where a step says so.

Frontdesk is three parts. GitHub Issues hold every request, card and result. A coordinator on a machine dispatches agents onto `autopilot` issues through Orca. The frontdesk app on ceres (`https://frontdesk.snowy-betta.ts.net`) shows it all on Milky's phone.

**Status.** written, not yet run on a second machine · **Owns.** the setup steps for a machine and a project

## 1. Set up the machine (once)

1. Check the tools and install any that are missing: `claude`, `gh`, `bun`, `mise`, `orca`, `git`. Run `gh auth status`; if it is not logged in, ask Milky to run `gh auth login`.
2. Clone milky-kit and link it as the kit:
   ```
   git clone https://github.com/milkyskies/milky-kit ~/Code/Projects/milky-kit
   ln -s ~/Code/Projects/milky-kit ~/.claude/kit
   ```
   The rules and skills call the program at `~/.claude/kit/modules/frontdesk/bin/frontdesk`, so the link path must be exact.
3. Install the plugin: `claude plugin install milky-kit@milkyskies`. If the marketplace is unknown, run `claude plugin marketplace add milkyskies/milky-kit` first.
4. Create `~/.config/frontdesk/.env` with mode 600:
   ```
   FRONTDESK_NTFY_URL=http://ceres:8091
   FRONTDESK_NTFY_TOPIC=<ask Milky for the topic; it is in ~/.config/frontdesk/.env on Minerva>
   ```
   The machine must be on the tailnet for `ceres` to resolve.
5. Check: `~/.claude/kit/modules/frontdesk/bin/frontdesk preflight --role coordinator`. Fix every line that is not `ok`.

## 2. Add a project (each project)

1. In the project, run `/milky-kit:retrofit` and keep the `issues` module on. This adds the issue rules and `.github/scripts/setup-labels.sh`.
2. Link the frontdesk worker rule: add `frontdesk.md` to `.claude/rules.manifest` and create `.claude/rules/frontdesk.md` as a relative symlink to the kit's `modules/frontdesk/rules/frontdesk.md`, the same way the retrofit linked `issues.md`.
3. Copy `~/.claude/kit/modules/frontdesk/frontdesk-section.md` to the end of the project's `CLAUDE.md`, then fill it:
   - `- machine:` the Orca machine name of this machine (for example `zeus`).
   - `- check:` the one command that proves the project works (`mise run check`, plus a build if it has one).
   - `- land:` `land:check` (Milky merges) unless Milky says `land:auto`.
   - `### Review paths`: only paths where a mistake is silent and costly (saves, money, data loss, a real database). Internal tooling gets none.
   - `### Blocked commands`: anything an agent must never run here (Milky's dev server ports, a production database).
   Keep the heading exactly `## frontdesk`; the program finds the section by that heading.
4. Create the labels: `.github/scripts/setup-labels.sh`.
5. Commit and push these files through the project's normal workflow (see its `.milky-kit-mode`).
6. Ask Milky to have the frontdesk service on ceres show the project: the repository goes into `FRONTDESK_REPOS` in the Dokploy frontdesk service (moss on ceres can do it). The GitHub App `milky-frontdesk` is installed on all of Milky's repositories, so nothing else is needed on GitHub.

## 3. Run it

1. File work as issues (`issues.md` has the body template). An issue an agent may take needs `stage:ready` and the `autopilot` label; only Milky adds `autopilot`.
2. Start the coordinator in the project: `/milky-kit:frontdesk`. It dispatches workers, pings Milky's phone for cards and finished work, and posts a daily digest.
3. Check from the phone: the project appears in the frontdesk app's project switcher, and its requests show on home.

## Notes

- Workers never merge. `land:check` waits for Milky's "looks good"; `land:auto` lets frontdesk merge after the check command passes.
- No reviewer and no `/simplify` on internal tooling; they cost tokens and the tests plus Milky using it are the review.
- More detail: [the plan](plan.md) (what frontdesk is), [phase 2](phase-2.md) (the coordinator), [phase 5](phase-5.md) (the app).
