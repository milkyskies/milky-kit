#!/usr/bin/env bash
# Read and write an issue's Status field on the GitHub Project, for the autopilot bookkeeping workflow.
#
# Sourced, not executed. Reads project coordinates from the committed .ghlobes.toml so the workflow and glb cannot drift apart on which project or field they mean.

set -euo pipefail

_toml() {
	grep -E "^${1}[[:space:]]*=" .ghlobes.toml | head -1 | sed -E 's/^[^=]*=[[:space:]]*"?([^"]*)"?[[:space:]]*$/\1/'
}

AUTOPILOT_OWNER="$(_toml owner)"
AUTOPILOT_REPO="$(_toml repo)"
AUTOPILOT_PROJECT="$(_toml project_number)"
AUTOPILOT_STATUS_FIELD="$(_toml status_field_id)"

if [ -z "$AUTOPILOT_PROJECT" ] || [ -z "$AUTOPILOT_STATUS_FIELD" ]; then
	echo "Could not read project_number / status_field_id from .ghlobes.toml" >&2
	exit 1
fi

# Echoes the issue's current Status, or nothing if the issue is not on the board.
current_status() {
	gh project item-list "$AUTOPILOT_PROJECT" --owner "$AUTOPILOT_OWNER" --format json --limit 500 |
		jq -r --arg url "https://github.com/$AUTOPILOT_OWNER/$AUTOPILOT_REPO/issues/$1" \
			'.items[] | select(.content.url == $url) | .status // empty'
}

_project_id() {
	gh api graphql -f query='
    query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) { projectV2(number: $number) { id } }
    }' -F owner="$AUTOPILOT_OWNER" -F repo="$AUTOPILOT_REPO" -F number="$AUTOPILOT_PROJECT" \
		-q '.data.repository.projectV2.id'
}

_item_id() {
	gh project item-list "$AUTOPILOT_PROJECT" --owner "$AUTOPILOT_OWNER" --format json --limit 500 |
		jq -r --arg url "https://github.com/$AUTOPILOT_OWNER/$AUTOPILOT_REPO/issues/$1" \
			'.items[] | select(.content.url == $url) | .id'
}

# Option IDs are looked up by name rather than hardcoded, because a board that was repaired by `glb init` gets fresh IDs for any option it had to append.
_option_id() {
	gh api graphql -f query='
    query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        projectV2(number: $number) {
          field(name: "Status") {
            ... on ProjectV2SingleSelectField { options { id name } }
          }
        }
      }
    }' -F owner="$AUTOPILOT_OWNER" -F repo="$AUTOPILOT_REPO" -F number="$AUTOPILOT_PROJECT" \
		-q ".data.repository.projectV2.field.options[] | select(.name == \"$1\") | .id"
}

set_status() {
	local issue="$1" status_name="$2"
	local project_id item_id option_id

	project_id="$(_project_id)"
	item_id="$(_item_id "$issue")"
	option_id="$(_option_id "$status_name")"

	if [ -z "$item_id" ]; then
		echo "Issue #$issue is not on project $AUTOPILOT_PROJECT. Nothing to do." >&2
		return 0
	fi

	if [ -z "$option_id" ]; then
		echo "Status '$status_name' does not exist on the board. Run 'glb init' to repair it." >&2
		return 1
	fi

	gh api graphql -f query='
    mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $projectId
        itemId: $itemId
        fieldId: $fieldId
        value: { singleSelectOptionId: $optionId }
      }) { projectV2Item { id } }
    }' -F projectId="$project_id" -F itemId="$item_id" \
		-F fieldId="$AUTOPILOT_STATUS_FIELD" -F optionId="$option_id" >/dev/null
}
