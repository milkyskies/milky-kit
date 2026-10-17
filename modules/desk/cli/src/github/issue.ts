import { parseJson, readArray, readBoolean, readField, readNumber, readString } from "../json.ts"
import { type Comment, type ParsedComment, parseComments } from "./derive.ts"
import { type Gh, type Repo, repoSlug } from "./gh.ts"

const ISSUE_QUERY = `query($owner: String!, $name: String!, $number: Int!, $before: String) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      number
      state
      body
      labels(first: 50) { nodes { name } }
      assignees(first: 10) { nodes { login } }
      comments(last: 100, before: $before) {
        pageInfo { hasPreviousPage startCursor }
        nodes { id databaseId body createdAt }
      }
      userContentEdits(first: 1) { totalCount }
      blockedBy(first: 20) { nodes { number state } }
      subIssues(first: 50) { nodes { number state } }
      closedByPullRequestsReferences(first: 20, includeClosedPrs: true) {
        nodes { number state isDraft mergeable }
      }
    }
  }
}`

export type LinkedPullRequest = {
	number: number
	state: string
	isDraft: boolean
	mergeable: string
}

export type IssueState = {
	number: number
	open: boolean
	body: string
	bodyEdits: number
	labels: string[]
	assignees: string[]
	comments: ParsedComment[]
	openBlockers: number[]
	openSubIssues: number[]
	pullRequests: LinkedPullRequest[]
}

export type Stage = { kind: "one"; label: string } | { kind: "ambiguous"; labels: string[] }

export function stageOf(issue: IssueState): Stage {
	const stages = issue.labels.filter((label) => label.startsWith("stage:"))
	const [only] = stages
	if (stages.length === 1 && only !== undefined) return { kind: "one", label: only }

	return { kind: "ambiguous", labels: stages }
}

export function stageText(issue: IssueState): string {
	const stage = stageOf(issue)
	if (stage.kind === "one") return stage.label

	return stage.labels.length === 0
		? "no stage label"
		: `several stage labels (${stage.labels.join(", ")})`
}

export function isUnclaimedIntake(issue: IssueState): boolean {
	return issue.labels.includes("request") && !issue.labels.includes("proposed")
}

export function hasStage(issue: IssueState, label: string): boolean {
	const stage = stageOf(issue)

	return stage.kind === "one" && stage.label === label
}

function nodesOf(value: unknown, key: string): unknown[] {
	return readArray(readField(value, key), "nodes")
}

function openNumbers(value: unknown, key: string): number[] {
	return nodesOf(value, key)
		.filter((node) => readString(node, "state") === "OPEN")
		.map((node) => readNumber(node, "number"))
}

function toComment(node: unknown): Comment {
	return {
		id: readString(node, "id"),
		databaseId: readNumber(node, "databaseId"),
		body: readString(node, "body"),
		createdAt: readString(node, "createdAt"),
	}
}

export function parseIssue(raw: string): IssueState {
	const issue = readField(readField(readField(parseJson(raw), "data"), "repository"), "issue")

	return {
		number: readNumber(issue, "number"),
		open: readString(issue, "state") === "OPEN",
		body: readString(issue, "body"),
		bodyEdits: readNumber(readField(issue, "userContentEdits"), "totalCount"),
		labels: nodesOf(issue, "labels").map((node) => readString(node, "name")),
		assignees: nodesOf(issue, "assignees").map((node) => readString(node, "login")),
		comments: parseComments(nodesOf(issue, "comments").map(toComment)),
		openBlockers: openNumbers(issue, "blockedBy"),
		openSubIssues: openNumbers(issue, "subIssues"),
		pullRequests: nodesOf(issue, "closedByPullRequestsReferences").map((node) => ({
			number: readNumber(node, "number"),
			state: readString(node, "state"),
			isDraft: readBoolean(node, "isDraft"),
			mergeable: readString(node, "mergeable"),
		})),
	}
}

async function readIssuePage(
	gh: Gh,
	repo: Repo,
	number: number,
	before: string | undefined,
): Promise<{ issue: IssueState; previousCursor: string | undefined }> {
	const args = [
		"api",
		"graphql",
		"-f",
		`query=${ISSUE_QUERY}`,
		"-F",
		`owner=${repo.owner}`,
		"-F",
		`name=${repo.name}`,
		"-F",
		`number=${number}`,
	]
	if (before !== undefined) args.push("-f", `before=${before}`)

	const raw = await gh(args)
	const pageInfo = readField(
		readField(readField(readField(parseJson(raw), "data"), "repository"), "issue"),
		"comments",
	)
	const info = readField(pageInfo, "pageInfo")
	const previousCursor =
		readBoolean(info, "hasPreviousPage") === true ? readString(info, "startCursor") : undefined

	return { issue: parseIssue(raw), previousCursor }
}

export async function readIssue(gh: Gh, repo: Repo, number: number): Promise<IssueState> {
	const first = await readIssuePage(gh, repo, number, undefined)
	let comments = first.issue.comments
	let cursor = first.previousCursor

	while (cursor !== undefined) {
		const page = await readIssuePage(gh, repo, number, cursor)
		comments = [...page.issue.comments, ...comments]
		cursor = page.previousCursor
	}

	return { ...first.issue, comments }
}

export type PullRequestState = {
	number: number
	open: boolean
	isDraft: boolean
	body: string
	mergeable: string
	headSha: string
	baseRef: string
}

export async function readPullRequest(
	gh: Gh,
	repo: Repo,
	number: number,
): Promise<PullRequestState> {
	const raw = await gh([
		"pr",
		"view",
		String(number),
		"--repo",
		repoSlug(repo),
		"--json",
		"number,state,isDraft,body,mergeable,headRefOid,baseRefName",
	])
	const pr = parseJson(raw)

	return {
		number: readNumber(pr, "number"),
		open: readString(pr, "state") === "OPEN",
		isDraft: readBoolean(pr, "isDraft"),
		body: readString(pr, "body"),
		mergeable: readString(pr, "mergeable"),
		headSha: readString(pr, "headRefOid"),
		baseRef: readString(pr, "baseRefName"),
	}
}
