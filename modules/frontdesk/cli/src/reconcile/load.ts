import { parseComments } from "../github/derive.ts"
import type { Gh, Repo } from "../github/gh.ts"
import { type IssueState, readIssue } from "../github/issue.ts"
import { parseJson, readArray, readBoolean, readField, readNumber, readString } from "../json.ts"

const LIST_QUERY = `query($owner: String!, $name: String!, $states: [IssueState!], $after: String) {
  repository(owner: $owner, name: $name) {
    issues(states: $states, first: 50, after: $after, orderBy: {field: UPDATED_AT, direction: DESC}) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number
        title
        state
        body
        labels(first: 50) { nodes { name } }
        assignees(first: 10) { nodes { login } }
        comments(last: 50) { nodes { id databaseId body createdAt } }
        userContentEdits(first: 1) { totalCount }
        blockedBy(first: 20) { nodes { number state } }
        subIssues(first: 50) { nodes { number state } }
        closedByPullRequestsReferences(first: 20, includeClosedPrs: true) {
          nodes { number state isDraft mergeable headRefOid }
        }
      }
    }
  }
}`

function nodesOf(value: unknown, key: string): unknown[] {
	return readArray(readField(value, key), "nodes")
}

function openNumbers(value: unknown, key: string): number[] {
	return nodesOf(value, key)
		.filter((node) => readString(node, "state") === "OPEN")
		.map((node) => readNumber(node, "number"))
}

function parseNode(node: unknown): IssueState {
	return {
		number: readNumber(node, "number"),
		title: readString(node, "title"),
		open: readString(node, "state") === "OPEN",
		body: readString(node, "body"),
		bodyEdits: readNumber(readField(node, "userContentEdits"), "totalCount"),
		labels: nodesOf(node, "labels").map((label) => readString(label, "name")),
		assignees: nodesOf(node, "assignees").map((assignee) => readString(assignee, "login")),
		comments: parseComments(
			nodesOf(node, "comments").map((comment) => ({
				id: readString(comment, "id"),
				databaseId: readNumber(comment, "databaseId"),
				body: readString(comment, "body"),
				createdAt: readString(comment, "createdAt"),
			})),
		),
		openBlockers: openNumbers(node, "blockedBy"),
		openSubIssues: openNumbers(node, "subIssues"),
		pullRequests: nodesOf(node, "closedByPullRequestsReferences").map((pr) => ({
			number: readNumber(pr, "number"),
			state: readString(pr, "state"),
			isDraft: readBoolean(pr, "isDraft"),
			mergeable: readString(pr, "mergeable"),
			headSha: readString(pr, "headRefOid"),
		})),
	}
}

async function listIssues(
	gh: Gh,
	repo: Repo,
	state: "OPEN" | "CLOSED",
	allPages: boolean,
): Promise<IssueState[]> {
	const issues: IssueState[] = []
	let after: string | undefined

	for (;;) {
		const args = [
			"api",
			"graphql",
			"-f",
			`query=${LIST_QUERY}`,
			"-F",
			`owner=${repo.owner}`,
			"-F",
			`name=${repo.name}`,
			"-f",
			`states=${state}`,
		]
		if (after !== undefined) args.push("-f", `after=${after}`)

		const connection = readField(
			readField(readField(parseJson(await gh(args)), "data"), "repository"),
			"issues",
		)
		issues.push(...readArray(connection, "nodes").map(parseNode))

		const pageInfo = readField(connection, "pageInfo")
		if (!allPages || readField(pageInfo, "hasNextPage") !== true) return issues

		after = readString(pageInfo, "endCursor")
	}
}

export async function loadIssues(
	gh: Gh,
	repo: Repo,
	wantedNumbers: Iterable<number> = [],
): Promise<IssueState[]> {
	const open = await listIssues(gh, repo, "OPEN", true)
	const recentlyClosed = await listIssues(gh, repo, "CLOSED", false)
	const issues = [...open, ...recentlyClosed]
	const known = new Set(issues.map((issue) => issue.number))

	for (const number of wantedNumbers) {
		if (known.has(number)) continue

		issues.push(await readIssue(gh, repo, number))
		known.add(number)
	}

	return issues
}
