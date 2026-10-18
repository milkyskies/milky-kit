import { type Gh, GhError } from "../../github/gh.ts"
import { FAKE_REPO, type FakeGithub, makeHarness } from "../../github/testing/fake-gh.ts"
import { parseJson, readField } from "../../json.ts"

export type Extras = {
	pageSize: number
	checkRuns: Record<string, unknown>[]
	annotations: Map<number, { message: string }[]>
	actionsEnabled: boolean
	failMerge: boolean
	failPatch: boolean
}

function flagValue(args: readonly string[], name: string): string | undefined {
	const pair = args.find((arg) => arg.startsWith(`${name}=`))

	return pair?.slice(name.length + 1)
}

export function withListing(fake: FakeGithub) {
	const extras: Extras = {
		pageSize: 50,
		checkRuns: [],
		annotations: new Map(),
		actionsEnabled: true,
		failMerge: false,
		failPatch: false,
	}

	const issueNode = async (number: number): Promise<unknown> => {
		const payload = await fake.gh(["api", "graphql", "-F", `number=${number}`])

		return readField(readField(readField(parseJson(payload), "data"), "repository"), "issue")
	}

	const list = async (args: readonly string[]): Promise<string> => {
		const state = flagValue(args, "states")
		const after = Number(flagValue(args, "after") ?? 0)
		const numbers = [...fake.issues.values()]
			.filter((issue) => issue.state === state)
			.map((issue) => issue.number)
			.sort((left, right) => right - left)
		const page = numbers.slice(after, after + extras.pageSize)
		const nodes = await Promise.all(page.map(issueNode))
		const next = after + extras.pageSize

		return JSON.stringify({
			data: {
				repository: {
					issues: {
						pageInfo: { hasNextPage: next < numbers.length, endCursor: String(next) },
						nodes,
					},
				},
			},
		})
	}

	const gh: Gh = async (args, input) => {
		const [group, second] = args
		const joined = args.join(" ")

		if (group === "api" && second === "graphql" && joined.includes("issues(states")) {
			fake.calls.push([...args])

			return list(args)
		}

		if (group === "issue" && second === "close") {
			fake.calls.push([...args])
			fake.issue(Number(args[2])).state = "CLOSED"

			return ""
		}

		if (group === "pr" && second === "merge") {
			fake.calls.push([...args])
			if (extras.failMerge) throw new GhError(args, "Pull request is not mergeable")
			const pr = fake.pullRequests.get(Number(args[2]))
			if (pr) pr.state = "MERGED"

			return ""
		}

		const patch = /^repos\/[^/]+\/[^/]+\/issues\/comments\/(\d+)$/.exec(
			args.find((arg) => arg.startsWith("repos/")) ?? "",
		)
		if (group === "api" && args.includes("PATCH") && patch) {
			fake.calls.push([...args])
			if (extras.failPatch) throw new GhError(args, "HTTP 500")

			const databaseId = Number(patch[1])
			const comment = [...fake.issues.values()]
				.flatMap((issue) => issue.comments)
				.find((candidate) => candidate.databaseId === databaseId)
			if (comment) comment.body = String(readField(parseJson(input ?? "{}"), "body"))

			return "{}"
		}

		if (group === "api" && args[1] === "user") return "milkyskies\n"

		if (group === "api") {
			const route = args.find((arg) => arg.startsWith("repos/")) ?? ""
			const tail = route.replace(`repos/${FAKE_REPO}/`, "")

			if (tail === "actions/permissions") {
				fake.calls.push([...args])

				return JSON.stringify({ enabled: extras.actionsEnabled })
			}

			if (/^commits\/[^/]+\/check-runs$/.test(tail)) {
				fake.calls.push([...args])

				return JSON.stringify({ check_runs: extras.checkRuns })
			}

			const annotation = /^check-runs\/(\d+)\/annotations$/.exec(tail)
			if (annotation) {
				fake.calls.push([...args])

				return JSON.stringify(extras.annotations.get(Number(annotation[1])) ?? [])
			}
		}

		return fake.gh(args, input)
	}

	return { gh, extras }
}

export function makeListingHarness(options: { json?: boolean } = {}) {
	const harness = makeHarness(options)
	const { gh, extras } = withListing(harness.fake)

	return { ...harness, extras, context: { ...harness.context, gh } }
}
