#!/bin/sh
set -eu

cli=$(cd "$(dirname "$0")/.." && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

(cd "$cli" && pnpm pack --pack-destination "$work/pack" >/dev/null)
tarball=$(ls "$work"/pack/*.tgz)

mkdir "$work/project"
cd "$work/project"
printf '{"name":"scratch","private":true,"type":"module"}\n' > package.json
pnpm add "$tarball" --ignore-scripts >/dev/null

cat > check.ts <<'CHECK'
import { cardProblems } from "@milkyskies/desk/cards"
import { openCards, parseComments } from "@milkyskies/desk/derive"
import { parseMarker } from "@milkyskies/desk/markers"
import { parseResult } from "@milkyskies/desk/result"

const marker = parseMarker("<!-- desk:decision claim=c_1 card=c_1-1 -->\nbody")
if (marker?.attrs.card !== "c_1-1") throw new Error("parseMarker lost the card id")

const [card] = parseComments([
	{ id: "IC_1", databaseId: 1, body: "<!-- desk:decision claim=c_1 card=c_1-1 -->\nQ?", createdAt: "2026-10-16T14:00:00Z" },
])
if (!card || openCards([card]).length !== 1) throw new Error("openCards did not see the open card")
if (cardProblems("not a card").length === 0) throw new Error("cardProblems accepted junk")
if (typeof parseResult !== "function") throw new Error("parseResult missing")
CHECK
bun check.ts

status=0
./node_modules/.bin/desk --repo owner/name answer 2>"$work/stderr" || status=$?
if [ "$status" -ne 2 ] || ! grep -q "desk: answer" "$work/stderr"; then
	echo "desk bin from the tarball did not reach the answer command (exit $status)" >&2
	cat "$work/stderr" >&2
	exit 1
fi

echo "pack-check: the tarball installs, its parsers import, and the desk bin runs"
