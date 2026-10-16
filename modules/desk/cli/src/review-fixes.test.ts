import { describe, expect, test } from "bun:test"

import { run as answer } from "./commands/answer.ts"
import { run as claim } from "./commands/claim.ts"
import { run as done } from "./commands/done.ts"
import { run as fail } from "./commands/fail.ts"
import { run as note } from "./commands/note.ts"
import { run as park } from "./commands/park.ts"
import { run as release } from "./commands/release.ts"
import { run as reopen } from "./commands/reopen.ts"
import { attemptCount, owningClaim, parseComments } from "./github/derive.ts"
import { readIssue } from "./github/issue.ts"
import { composeComment } from "./github/markers.ts"
import { FakeGithub, makeHarness } from "./github/testing/fake-gh.ts"
import { claimBody, decisionCard, failureOf, seedWorking } from "./github/testing/seed.ts"
import { main } from "./main.ts"

const CLAIM_FLAGS = ["--machine", "zeus", "--task", "t2", "--dispatch", "ctx_next"]

function takeOver(fake: FakeGithub, number: number): void {
	fake.afterNextRead = () => {
		fake.addComment(
			number,
			composeComment("release", { claim: "c_first1", reason: "no-worker" }, "Released."),
		)
		fake.addComment(number, claimBody("c_other2", "ctx_other"))
	}
}

function pullRequest(fake: FakeGithub, mergeable: "MERGEABLE" | "UNKNOWN"): void {
	fake.pullRequests.set(45, {
		number: 45,
		state: "OPEN",
		isDraft: false,
		body: "closes #12",
		mergeable,
		headRefOid: "headsha",
		baseRefName: "main",
		behindBy: 0,
	})
}

const DONE_FLAGS = [
	"--dispatch",
	"ctx_y",
	"--pr",
	"45",
	"--summary",
	"Done.",
	"--no-picture",
	"none",
	"--checked",
	"ok",
]

describe("finding 1: reopen releases the old claim", () => {
	test("a reopened issue can be claimed again", async () => {
		const { fake, context } = makeHarness()
		seedWorking(fake, 12).labels = ["request", "autopilot", "stage:check"]
		const reason = fake.addComment(12, "no, because it is wrong")

		await reopen(["12", "--comment", String(reason.databaseId)], context)
		await claim(["12", ...CLAIM_FLAGS], context)

		const comments = parseComments(fake.issue(12).comments)
		expect(comments.some((c) => c.marker?.attrs.reason === "reopened")).toBe(true)
		expect(owningClaim(comments)?.dispatch).toBe("ctx_next")
		expect(fake.issue(12).labels).toContain("stage:working")
	})
})

describe("finding 2: the claim must still be the caller's on the second read", () => {
	test("park exits 4 when the claim moved to another worker", async () => {
		const { fake, context } = makeHarness()
		seedWorking(fake, 12)
		fake.files.set("card.md", decisionCard("code-detail"))
		takeOver(fake, 12)

		const result = await failureOf(
			park(["12", "--dispatch", "ctx_y", "--card", "card.md"], context),
		)

		expect(result.code).toBe(4)
		expect(result.message).toContain("claim c_first1 still owning the issue")
	})

	test("done exits 4 when the claim moved to another worker", async () => {
		const { fake, context } = makeHarness()
		seedWorking(fake, 12)
		fake.issue(12).pullRequests = [45]
		pullRequest(fake, "MERGEABLE")
		takeOver(fake, 12)

		expect((await failureOf(done(["12", ...DONE_FLAGS], context))).code).toBe(4)
	})

	test("fail exits 4 when another worker holds a live claim afterwards", async () => {
		const { fake, context } = makeHarness()
		seedWorking(fake, 12)
		fake.files.set("reason.md", "tried")
		fake.afterNextRead = () => {
			fake.addComment(12, claimBody("c_other2", "ctx_other"))
		}

		const result = await failureOf(
			fail(["12", "--dispatch", "ctx_y", "--reason", "reason.md"], context),
		)

		expect(result.code).toBe(4)
	})
})

describe("finding 3: one definition of the owning claim", () => {
	test("the winner can still park while the loser's claim comment lingers", async () => {
		const { fake, context } = makeHarness()
		seedWorking(fake, 12)
		fake.addComment(12, claimBody("c_loser1", "ctx_loser"))
		fake.files.set("card.md", decisionCard("code-detail"))

		await park(["12", "--dispatch", "ctx_y", "--card", "card.md"], context)
		expect(fake.issue(12).labels).toContain("stage:needs-you")

		const loser = await failureOf(
			park(["12", "--dispatch", "ctx_loser", "--card", "card.md"], context),
		)
		expect(loser.code).toBe(1)
	})
})

describe("finding 4: only real failures count as attempts", () => {
	test("lost-race, answered and reopened releases are not attempts", () => {
		const release = (reason: string) => ({
			id: reason,
			databaseId: 1,
			createdAt: "",
			body: composeComment("release", { claim: "c", reason }, "r"),
		})
		const comments = parseComments(["lost-race", "answered", "reopened", "stopped"].map(release))

		expect(attemptCount(comments)).toBe(1)
	})

	test("a desk fail after a lost race writes attempt=1", async () => {
		const { fake, context } = makeHarness()
		seedWorking(fake, 12)
		fake.addComment(12, composeComment("release", { claim: "c_x", reason: "lost-race" }, "lost"))
		fake.files.set("reason.md", "tried")

		await fail(["12", "--dispatch", "ctx_y", "--reason", "reason.md"], context)

		expect(fake.issue(12).comments.at(-1)?.body).toStartWith(
			"<!-- desk:failed claim=c_first1 attempt=1 -->",
		)
	})
})

describe("finding 5: unexpected errors never exit 1", () => {
	test("non-JSON output before any write exits 3", async () => {
		const fake = new FakeGithub()
		fake.addIssue({ number: 12 })
		const gh = async (args: readonly string[], input?: string) =>
			args[1] === "graphql" ? "<html>oops" : fake.gh(args, input)

		expect(await main(["status", "12", "--repo", "milkyskies/kit"], gh)).toBe(3)
	})

	test("non-JSON output after a write exits 4", async () => {
		const fake = new FakeGithub()
		fake.addIssue({ number: 12 })
		const gh = async (args: readonly string[], input?: string) => {
			const out = await fake.gh(args, input)

			return args.includes("POST") ? "<html>oops" : out
		}

		const code = await main(
			[
				"claim",
				"12",
				"--machine",
				"zeus",
				"--task",
				"t",
				"--dispatch",
				"d",
				"--repo",
				"milkyskies/kit",
			],
			gh,
		)

		expect(code).toBe(4)
		expect(fake.issue(12).comments).toHaveLength(1)
	})
})

describe("finding 6: an unknown mergeable state is never reported as verified", () => {
	test("done retries while UNKNOWN and verifies once GitHub answers", async () => {
		const { fake, context } = makeHarness()
		seedWorking(fake, 12)
		fake.issue(12).pullRequests = [45]
		pullRequest(fake, "UNKNOWN")
		context.sleep = async () => {
			const pr = fake.pullRequests.get(45)
			if (pr) pr.mergeable = "MERGEABLE"
		}

		await done(["12", ...DONE_FLAGS], context)

		expect(fake.issue(12).comments.at(-1)?.body).toContain(
			"is not CONFLICTING (GitHub says MERGEABLE)",
		)
	})

	test("done that still sees UNKNOWN keeps it out of the Verified line", async () => {
		const { fake, context } = makeHarness()
		seedWorking(fake, 12)
		fake.issue(12).pullRequests = [45]
		pullRequest(fake, "UNKNOWN")

		await done(["12", ...DONE_FLAGS], context)

		const body = fake.issue(12).comments.at(-1)?.body ?? ""
		expect(body).not.toContain("not CONFLICTING")
		expect(body).toContain("**Mergeable state:** GitHub had not computed it")
		expect(body).not.toMatch(/Verified by desk:.*UNKNOWN/)
	})
})

describe("finding 7a: long comment histories", () => {
	test("readIssue pages back through every comment", async () => {
		const { fake, context } = makeHarness()
		fake.addIssue({ number: 12 })
		for (let index = 0; index < 250; index += 1) fake.addComment(12, `comment ${index}`)

		const issue = await readIssue(context.gh, context.repo, 12)

		expect(issue.comments).toHaveLength(250)
		expect(issue.comments[0]?.body).toBe("comment 0")
		expect(issue.comments.at(-1)?.body).toBe("comment 249")
	})

	test("park still succeeds on an issue with more than 100 comments", async () => {
		const { fake, context } = makeHarness()
		fake.addIssue({ number: 12, labels: ["request", "autopilot", "stage:working"] })
		fake.addComment(12, claimBody("c_first1"))
		for (let index = 0; index < 120; index += 1) fake.addComment(12, `chatter ${index}`)
		fake.files.set("card.md", decisionCard("code-detail"))

		await park(["12", "--dispatch", "ctx_y", "--card", "card.md"], context)

		expect(fake.issue(12).labels).toContain("stage:needs-you")
	})
})

describe("finding 7b: body edits do not drop the other command's lines", () => {
	test("desk note keeps a decision appended between its first read and its write", async () => {
		const { fake, context } = makeHarness()
		seedWorking(fake, 12)
		fake.afterNextRead = (issue) => {
			issue.body += "\n## Decisions\n\n- 2026-10-16: use magic links\n"
		}

		await note(["12", "--dispatch", "ctx_y", "Auto-decided: a over b because c"], context)

		expect(fake.issue(12).body).toContain("- 2026-10-16: use magic links")
		expect(fake.issue(12).body).toContain("Auto-decided: a over b because c")
	})

	test("desk answer keeps a small call appended between its first read and its write", async () => {
		const { fake, context } = makeHarness()
		seedWorking(fake, 12).labels = ["request", "autopilot", "stage:needs-you"]
		fake.files.set("answer.md", "Go.")
		fake.afterNextRead = (issue) => {
			issue.body += "\n## Small calls\n\n- 2026-10-16: Auto-decided: x over y because z\n"
		}

		await answer(["12", "--body", "answer.md", "--decision", "go"], context)

		expect(fake.issue(12).body).toContain("Auto-decided: x over y because z")
		expect(fake.issue(12).body).toContain("- 2026-10-16: go")
	})
})

describe("re-review A: orphaned claims at any stage can be cleared", () => {
	test("release --claim clears a claim left at stage:ready by a killed worker", async () => {
		const { fake, context } = makeHarness()
		fake.addIssue({ number: 12 })
		fake.addComment(12, claimBody("c_dead01", "ctx_dead"))

		await release(["12", "--reason", "no-worker", "--claim", "c_dead01"], context)
		await claim(["12", ...CLAIM_FLAGS], context)

		expect(fake.issue(12).labels).toContain("stage:working")
	})

	test("release --claim on a lingering loser leaves the working owner and the stage alone", async () => {
		const { fake, context } = makeHarness()
		seedWorking(fake, 12)
		fake.addComment(12, claimBody("c_loser1", "ctx_loser"))

		await release(["12", "--reason", "stopped", "--claim", "c_loser1"], context)

		expect(fake.issue(12).labels).toContain("stage:working")
		expect(owningClaim(parseComments(fake.issue(12).comments))?.id).toBe("c_first1")
	})

	test("fail closes a lingering loser too, so the issue can be claimed again", async () => {
		const { fake, context } = makeHarness()
		seedWorking(fake, 12)
		fake.addComment(12, claimBody("c_loser1", "ctx_loser"))
		fake.files.set("reason.md", "tried")

		await fail(["12", "--dispatch", "ctx_y", "--reason", "reason.md"], context)
		await claim(["12", ...CLAIM_FLAGS], context)

		expect(fake.issue(12).labels).toContain("stage:working")
	})

	test("reopen closes a lingering loser and verifies no claim remains", async () => {
		const { fake, context } = makeHarness()
		seedWorking(fake, 12).labels = ["request", "autopilot", "stage:check"]
		fake.addComment(12, claimBody("c_loser1", "ctx_loser"))
		const reason = fake.addComment(12, "no, because")

		await reopen(["12", "--comment", String(reason.databaseId)], context)

		expect(owningClaim(parseComments(fake.issue(12).comments))).toBeUndefined()
	})

	test("answer closes a lingering loser too", async () => {
		const { fake, context } = makeHarness()
		seedWorking(fake, 12).labels = ["request", "autopilot", "stage:needs-you"]
		fake.addComment(12, claimBody("c_loser1", "ctx_loser"))
		fake.files.set("answer.md", "Go.")

		await answer(["12", "--body", "answer.md", "--decision", "go"], context)

		expect(owningClaim(parseComments(fake.issue(12).comments))).toBeUndefined()
	})
})

describe("re-review B: a write between the fresh read and the edit is detected", () => {
	test("desk note exits 4 when another writer edits after the fresh read", async () => {
		const { fake, context } = makeHarness()
		seedWorking(fake, 12)
		fake.afterRead(2, (issue) => {
			issue.body += "\n## Decisions\n\n- 2026-10-16: use magic links\n"
			issue.bodyEdits += 1
		})

		const result = await failureOf(
			note(["12", "--dispatch", "ctx_y", "Auto-decided: a over b because c"], context),
		)

		expect(result.code).toBe(4)
		expect(result.message).toContain("2 body edits since the fresh read")
	})

	test("desk answer exits 4 when another writer edits after the fresh read", async () => {
		const { fake, context } = makeHarness()
		seedWorking(fake, 12).labels = ["request", "autopilot", "stage:needs-you"]
		fake.files.set("answer.md", "Go.")
		fake.afterRead(2, (issue) => {
			issue.body += "\n## Small calls\n\n- 2026-10-16: Auto-decided: x over y because z\n"
			issue.bodyEdits += 1
		})

		expect(
			(await failureOf(answer(["12", "--body", "answer.md", "--decision", "go"], context))).code,
		).toBe(4)
	})
})
