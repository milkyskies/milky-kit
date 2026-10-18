import { FrontdeskError } from "../../errors.ts"
import { composeComment } from "../markers.ts"
import type { FakeGithub, FakeIssue } from "./fake-gh.ts"

export const DISPATCH = "ctx_y"

export function claimBody(
	id: string,
	dispatch = DISPATCH,
	machine = "zeus",
	role?: string,
): string {
	return composeComment(
		"claim",
		{
			id,
			machine,
			task: "task_x",
			dispatch,
			at: "2026-10-16T14:02:00Z",
			...(role === undefined ? {} : { role }),
		},
		"Claimed.",
	)
}

export function seedWorking(fake: FakeGithub, number: number, dispatch = DISPATCH): FakeIssue {
	const issue = fake.addIssue({ number, labels: ["request", "autopilot", "stage:working"] })
	fake.addComment(number, claimBody("c_first1", dispatch))

	return issue
}

export function secondCard(): string {
	return decisionCard("design").replace(
		"Which retry count should the client use?",
		"Which timeout should the client use?",
	)
}

export function seedParked(
	fake: FakeGithub,
	number: number,
	cardCount: number,
	role?: string,
): FakeIssue {
	const issue = fake.addIssue({ number, labels: ["request", "autopilot", "stage:needs-you"] })
	fake.addComment(number, claimBody("c_first1", DISPATCH, "zeus", role))
	for (let index = 1; index <= cardCount; index += 1) {
		fake.addComment(
			number,
			composeComment(
				"decision",
				{ claim: "c_first1", card: `c_first1-${index}` },
				`## Card ${index}`,
			),
		)
	}

	return issue
}

export function seedFrontmanWorking(fake: FakeGithub, number: number): FakeIssue {
	const issue = fake.addIssue({ number, labels: ["request", "priority:P2", "stage:working"] })
	fake.addComment(number, claimBody("c_first1", DISPATCH, "zeus", "frontman"))

	return issue
}

export function decisionCard(kind: "code-detail" | "design", extra = ""): string {
	const closing =
		kind === "code-detail"
			? "**Recommendation:** use the retry count of three.\n"
			: "<details><summary>What would I pick?</summary>\n\nThe second, because it is smaller.\n\n</details>\n"

	return `<!-- frontdesk:decision -->
## Decision needed

**Kind:** ${kind}

The background sentence. Which retry count should the client use?

**Already checked:** grep for retry in src found one constant.

**Options:**
1. three retries - matches the server. → Retries = 3, the same as the server.
2. five retries - matches the old client. → Retries = 5, the same as the old client.

${closing}${extra}`
}

export async function failureOf(
	promise: Promise<unknown>,
): Promise<{ code: number; message: string }> {
	try {
		await promise
	} catch (error) {
		if (error instanceof FrontdeskError) return { code: error.exitCode, message: error.message }

		throw error
	}

	throw new Error("expected the command to fail")
}
