#!/usr/bin/env bash
set -euo pipefail

create_label() {
  gh label create "$1" --color "$2" --description "$3" --force
}

create_label request "1d76db" "Work to be built"
create_label exploration "5319e7" "A topic to think through before any build"
create_label proposed "fbca04" "Filed by an agent, starts only on a human yes"

create_label stage:backlog "cfd3d7" "Parked for later"
create_label stage:intake "c5def5" "Filed, still being clarified"
create_label stage:ready "0e8a16" "Fully decided, waiting for a worker"
create_label stage:working "1d76db" "A worker has claimed it"
create_label stage:needs-you "d93f0b" "Waiting on a human decision"
create_label stage:check "fbca04" "PR open, waiting for a human to check and merge"
create_label stage:done "6f42c1" "Finished and closed"

create_label ask:everything "bfdadc" "Every unclear point becomes a question"
create_label ask:choices "bfd4f2" "Only the real choices become questions"
create_label ask:own-feel "d4c5f9" "The agent decides and logs each call"

create_label priority:P0 "b60205" "Broken, crashing, losing data, or a security hole"
create_label priority:P1 "d93f0b" "Blocks other work, or has a named deadline"
create_label priority:P2 "fbca04" "Everything else (default)"
create_label priority:P3 "c2e0c6" "Someday"
create_label priority:P4 "e4e669" "Backlog, nice to have"

for points in 1 2 3 5 8 13; do
  create_label "points:${points}" "ededed" "Effort estimate: ${points}"
done

create_label type:feature "a2eeef" "New capability; nothing there before"
create_label type:change "7057ff" "An existing feature behaves differently"
create_label type:fix "d73a4a" "Broken; restore intended behaviour"
create_label type:chore "cfd3d7" "Dependencies, CI, tooling, config"
create_label type:docs "0075ca" "Documentation only"
create_label type:refactor "e99695" "Internals move, behaviour identical"

create_label autopilot "0e8a16" "An autonomous agent may claim this issue"

create_label land:check "fbca04" "A human comments looks good before the pull request merges"
create_label land:auto "0e8a16" "The frontdesk merges the pull request itself once its checks pass"
