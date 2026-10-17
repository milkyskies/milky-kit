#!/bin/sh
set -eu

bump=${1:-patch}
case "$bump" in
patch | minor | major) ;;
*)
	echo "desk:publish: usage: mise run desk:publish [patch|minor|major]" >&2
	exit 2
	;;
esac

if [ -z "${NODE_AUTH_TOKEN:-}" ]; then
	echo "desk:publish: set NODE_AUTH_TOKEN to a classic personal access token with write:packages" >&2
	exit 1
fi

cd "$(dirname "$0")/.."

bun test
bun run typecheck
sh scripts/pack-check.sh

pnpm version "$bump" --no-git-tag-version >/dev/null
version=$(node -p "require('./package.json').version")

config=$(mktemp)
trap 'rm -f "$config"' EXIT
printf '//npm.pkg.github.com/:_authToken=%s\n' "$NODE_AUTH_TOKEN" >"$config"

if ! NPM_CONFIG_USERCONFIG="$config" pnpm publish --no-git-checks; then
	git checkout -- package.json
	echo "desk:publish: publish failed, package.json restored" >&2
	exit 1
fi

echo "published @milkyskies/desk@$version. Commit modules/desk/cli/package.json."
