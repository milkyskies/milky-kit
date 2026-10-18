#!/bin/sh
# One-time rewrite of `<!-- desk:* -->` marker comments to `<!-- frontdesk:* -->`.
# Usage: migrate-markers.sh [--apply] <owner/repo>...   (dry run unless --apply)
set -eu

apply=0
if [ "${1:-}" = "--apply" ]; then
	apply=1
	shift
fi

if [ "$#" -eq 0 ]; then
	echo "usage: $0 [--apply] <owner/repo>..." >&2
	exit 2
fi

total=0
for repository in "$@"; do
	comments=$(gh api --paginate "repos/$repository/issues/comments?per_page=100" \
		--jq '.[] | select(.body | test("<!-- desk:")) | .id')
	count=0
	for comment_id in $comments; do
		count=$((count + 1))
		if [ "$apply" -eq 1 ]; then
			body=$(gh api "repos/$repository/issues/comments/$comment_id" --jq .body | sed 's/<!-- desk:/<!-- frontdesk:/g')
			gh api -X PATCH "repos/$repository/issues/comments/$comment_id" -f body="$body" >/dev/null
			sleep 1
		fi
	done
	echo "$repository: $count comment(s) $([ "$apply" -eq 1 ] && echo edited || echo "would be edited")"
	total=$((total + count))
done
echo "total: $total"
