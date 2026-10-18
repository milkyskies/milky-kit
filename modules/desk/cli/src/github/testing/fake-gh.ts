import type { Context } from "../../context.ts"
import { type Gh, GhError } from "../gh.ts"

export type FakeComment = { id: string; databaseId: number; body: string; createdAt: string }

export type FakeIssue = {
	number: number
	title: string
	state: "OPEN" | "CLOSED"
	labels: string[]
	assignees: string[]
	body: string
	bodyEdits: number
	comments: FakeComment[]
	blockedBy: { number: number; state: string }[]
	subIssues: { number: number; state: string }[]
	pullRequests: number[]
	closeReason?: string | undefined
}

export type FakePullRequest = {
	number: number
	state: "OPEN" | "CLOSED" | "MERGED"
	isDraft: boolean
	body: string
	mergeable: "MERGEABLE" | "CONFLICTING" | "UNKNOWN"
	headRefOid: string
	baseRefName: string
	behindBy: number
}

type FakeFile = { sha: string; content: string }

export function recordBodyEdit(issue: FakeIssue): void {
	issue.bodyEdits += issue.bodyEdits === 0 ? 2 : 1
}

export const FAKE_REPO = "milkyskies/kit"

export class FakeGithub {
	readonly issues = new Map<number, FakeIssue>()
	readonly pullRequests = new Map<number, FakePullRequest>()
	readonly branches = new Map<string, Map<string, FakeFile>>()
	readonly calls: string[][] = []
	readonly files = new Map<string, string>()
	dropLabelWrites = false
	commentPageSize = 100
	afterNextRead: ((issue: FakeIssue) => void) | undefined
	private readCount = 0
	private readonly readHooks = new Map<number, (issue: FakeIssue) => void>()
	private commentCounter = 1000
	private shaCounter = 0
	private issueCounter = 100

	readonly gh: Gh = async (args, input) => {
		this.calls.push([...args])

		return this.handle(args, input)
	}

	addIssue(overrides: Partial<FakeIssue> & { number: number }): FakeIssue {
		const issue: FakeIssue = {
			title: `Request ${overrides.number}`,
			state: "OPEN",
			labels: ["request", "autopilot", "stage:ready"],
			assignees: [],
			body: "## Problem\n\nSomething is missing.\n",
			bodyEdits: 0,
			comments: [],
			blockedBy: [],
			subIssues: [],
			pullRequests: [],
			...overrides,
		}
		this.issues.set(issue.number, issue)

		return issue
	}

	addComment(issueNumber: number, body: string): FakeComment {
		const issue = this.mustIssue(issueNumber)
		this.commentCounter += 1
		const comment = {
			id: `IC_${this.commentCounter}`,
			databaseId: this.commentCounter,
			body,
			createdAt: `2026-10-16T14:${String(this.commentCounter - 1000).padStart(2, "0")}:00Z`,
		}
		issue.comments.push(comment)

		return comment
	}

	afterRead(ordinal: number, hook: (issue: FakeIssue) => void): void {
		this.readHooks.set(this.readCount + ordinal, hook)
	}

	issue(number: number): FakeIssue {
		return this.mustIssue(number)
	}

	callsMatching(prefix: string[]): string[][] {
		return this.calls.filter((call) => prefix.every((part, index) => call[index] === part))
	}

	private mustIssue(number: number): FakeIssue {
		const issue = this.issues.get(number)
		if (!issue) throw new GhError(["api"], `Could not resolve to an Issue ${number} (HTTP 404)`)

		return issue
	}

	private flag(args: readonly string[], name: string): string | undefined {
		const index = args.indexOf(name)

		return index === -1 ? undefined : args[index + 1]
	}

	private async handle(args: readonly string[], input: string | undefined): Promise<string> {
		const [group, second, third] = args

		if (group === "repo") return `${FAKE_REPO}\n`
		if (group === "issue" && second === "edit") return this.editIssue(args, input)
		if (group === "issue" && second === "close") return this.closeIssue(args)
		if (group === "issue" && second === "create") return this.createIssue(args, input)
		if (group === "pr" && second === "view") return this.viewPullRequest(Number(third))
		if (group === "api") return this.api(args, input)

		throw new Error(`fake gh has no response for: gh ${args.join(" ")}`)
	}

	private api(args: readonly string[], input: string | undefined): string {
		if (args[1] === "graphql") return this.readIssue(this.numberArg(args), this.cursorArg(args))

		const method = this.flag(args, "-X") ?? "GET"
		const path = args.find((arg) => arg.startsWith("repos/")) ?? ""
		const [route = "", query = ""] = path.replace(`repos/${FAKE_REPO}/`, "").split("?")

		return this.rest(method, route, query, input)
	}

	private numberArg(args: readonly string[]): number {
		const pair = args.find((arg) => arg.startsWith("number="))

		return Number(pair?.split("=")[1])
	}

	private cursorArg(args: readonly string[]): number | undefined {
		const pair = args.find((arg) => arg.startsWith("before="))

		return pair === undefined ? undefined : Number(pair.split("=")[1])
	}

	private readIssue(number: number, cursor?: number): string {
		const issue = this.mustIssue(number)
		const nodes = <T>(items: T[]) => ({ nodes: items })
		const end = cursor ?? issue.comments.length
		const start = Math.max(0, end - this.commentPageSize)
		const payload = {
			data: {
				repository: {
					issue: {
						number: issue.number,
						title: issue.title,
						state: issue.state,
						body: issue.body,
						userContentEdits: { totalCount: issue.bodyEdits },
						labels: nodes(issue.labels.map((name) => ({ name }))),
						assignees: nodes(issue.assignees.map((login) => ({ login }))),
						comments: {
							pageInfo: { hasPreviousPage: start > 0, startCursor: String(start) },
							nodes: issue.comments.slice(start, end),
						},
						blockedBy: nodes(issue.blockedBy),
						subIssues: nodes(issue.subIssues),
						closedByPullRequestsReferences: nodes(
							issue.pullRequests.flatMap((id) => {
								const pr = this.pullRequests.get(id)

								return pr
									? [
											{
												number: pr.number,
												state: pr.state,
												isDraft: pr.isDraft,
												mergeable: pr.mergeable,
											},
										]
									: []
							}),
						),
					},
				},
			},
		}

		this.readCount += 1
		const numbered = this.readHooks.get(this.readCount)
		const hooks = [this.afterNextRead, numbered]
		this.afterNextRead = undefined
		const serialized = JSON.stringify(payload)
		for (const hook of hooks) hook?.(issue)

		return serialized
	}

	private rest(method: string, route: string, query: string, input: string | undefined): string {
		const commentMatch = /^issues\/(\d+)\/comments$/.exec(route)
		if (method === "POST" && commentMatch) {
			const body = JSON.parse(input ?? "{}").body
			const comment = this.addComment(Number(commentMatch[1]), body)

			return JSON.stringify({ id: comment.databaseId })
		}

		const branchMatch = /^git\/ref\/heads\/(.+)$/.exec(route)
		if (method === "GET" && branchMatch) {
			if (!this.branches.has(branchMatch[1] ?? "")) {
				throw new GhError(["api", route], "Not Found (HTTP 404)")
			}

			return JSON.stringify({ ref: `refs/heads/${branchMatch[1]}` })
		}

		if (method === "POST" && route.startsWith("git/")) return this.gitData(route, input)

		const contentsMatch = /^contents\/(.+)$/.exec(route)
		if (contentsMatch) return this.contents(method, contentsMatch[1] ?? "", query, input)

		const compareMatch = /^compare\/(.+)\.\.\.(.+)$/.exec(route)
		if (compareMatch) {
			const pr = [...this.pullRequests.values()].find(
				(candidate) => candidate.headRefOid === compareMatch[2],
			)

			return JSON.stringify({
				behind_by: pr?.behindBy ?? 0,
				base_commit: { sha: "abc1234def5678" },
			})
		}

		throw new Error(`fake gh has no response for: gh api ${method} ${route}`)
	}

	private gitData(route: string, input: string | undefined): string {
		const payload = JSON.parse(input ?? "{}")
		this.shaCounter += 1
		const sha = `sha${this.shaCounter}`

		if (route === "git/refs") {
			const name = String(payload.ref).replace("refs/heads/", "")
			this.branches.set(name, new Map([["README.md", { sha: "readme", content: "" }]]))
		}

		return JSON.stringify({ sha })
	}

	private contents(method: string, path: string, query: string, input: string | undefined): string {
		const branchName =
			method === "GET" ? query.replace("ref=", "") : JSON.parse(input ?? "{}").branch
		const files = this.branches.get(branchName)
		if (!files) throw new GhError(["api", path], "No commit found for the ref (HTTP 404)")

		if (method === "GET") {
			const file = files.get(path)
			if (!file) throw new GhError(["api", path], "Not Found (HTTP 404)")

			return JSON.stringify({ sha: file.sha })
		}

		const payload = JSON.parse(input ?? "{}")
		const existing = files.get(path)
		if (existing && payload.sha !== existing.sha) {
			throw new GhError(["api", path], "sha wasn't supplied (HTTP 422)")
		}

		this.shaCounter += 1
		files.set(path, { sha: `file${this.shaCounter}`, content: String(payload.content) })

		return JSON.stringify({ content: { path } })
	}

	private editIssue(args: readonly string[], input: string | undefined): string {
		const issue = this.mustIssue(Number(args[2]))
		const adds = this.flag(args, "--add-label")?.split(",") ?? []
		const removes = this.flag(args, "--remove-label")?.split(",") ?? []

		if (!this.dropLabelWrites) {
			issue.labels = [...issue.labels.filter((label) => !removes.includes(label)), ...adds]
		}

		if (this.flag(args, "--add-assignee") === "@me") issue.assignees = ["milkyskies"]
		if (args.includes("--body-file")) {
			issue.body = input ?? ""
			recordBodyEdit(issue)
		}

		return ""
	}

	private closeIssue(args: readonly string[]): string {
		const issue = this.mustIssue(Number(args[2]))
		issue.state = "CLOSED"
		issue.closeReason = this.flag(args, "--reason")

		return ""
	}

	private createIssue(args: readonly string[], input: string | undefined): string {
		this.issueCounter += 1
		this.addIssue({
			number: this.issueCounter,
			labels: this.flag(args, "--label")?.split(",") ?? [],
			body: input ?? "",
		})

		return `https://github.com/${FAKE_REPO}/issues/${this.issueCounter}\n`
	}

	private viewPullRequest(number: number): string {
		const pr = this.pullRequests.get(number)
		if (!pr) throw new GhError(["pr", "view"], "no pull requests found (HTTP 404)")

		return JSON.stringify(pr)
	}
}

export type Harness = { fake: FakeGithub; context: Context; output: string[] }

export function makeHarness(options: { json?: boolean } = {}): Harness {
	const fake = new FakeGithub()
	const output: string[] = []
	let counter = 0
	const ids = ["8f3a2b", "9c4d3e", "aa55bb", "bb66cc"]

	const context: Context = {
		gh: fake.gh,
		repo: { owner: "milkyskies", name: "kit" },
		json: options.json ?? false,
		now: () => new Date("2026-10-16T14:02:00Z"),
		newId: () => ids[counter++ % ids.length] ?? "000000",
		out: (line) => output.push(line),
		readText: async (path) => {
			const text = fake.files.get(path)
			if (text === undefined) throw new Error(`no such file ${path}`)

			return text
		},
		sleep: async () => {},
		readBytes: async (path) => {
			const text = fake.files.get(path)
			if (text === undefined) throw new Error(`no such file ${path}`)

			return new TextEncoder().encode(text)
		},
	}

	return { fake, context, output }
}
