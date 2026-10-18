import { beforeEach, describe, expect, test } from "bun:test"
import { activeClaims, attemptCount, parseComments } from "../github/derive.ts"
import { composeComment } from "../github/markers.ts"
import { makeHarness } from "../github/testing/fake-gh.ts"
import { claimBody, failureOf, seedParked, seedWorking } from "../github/testing/seed.ts"
import { run as answer } from "./answer.ts"
import { run as claim } from "./claim.ts"

describe("frontdesk answer", () => {
	test("posts the human answer, records the decision, releases the claim, and moves to ready", async () => {
		const { fake, context } = makeHarness()
		seedWorking(fake, 12).labels = ["request", "autopilot", "stage:needs-you"]
		fake.files.set("answer.md", "Go with five retries.")

		await answer(["12", "--body", "answer.md", "--decision", "five retries"], context)

		const issue = fake.issue(12)
		expect(issue.labels).toContain("stage:ready")
		expect(issue.body).toContain("## Decisions\n\n- 2026-10-16: five retries")

		const comments = parseComments(issue.comments)
		expect(comments.at(-2)).toMatchObject({ body: "Go with five retries.", agent: false })
		expect(comments.at(-1)?.marker).toEqual({
			kind: "release",
			attrs: { claim: "c_first1", reason: "answered" },
		})
		expect(activeClaims(comments)).toHaveLength(0)
		expect(attemptCount(comments)).toBe(0)
	})

	test("lets the next worker claim after the answer", async () => {
		const { fake, context } = makeHarness()
		seedWorking(fake, 12).labels = ["request", "autopilot", "stage:needs-you"]
		fake.files.set("answer.md", "Go.")

		await answer(["12", "--body", "answer.md", "--decision", "go"], context)
		await claim(["12", "--machine", "zeus", "--task", "t2", "--dispatch", "ctx_next"], context)

		expect(fake.issue(12).labels).toContain("stage:working")
	})

	test("refuses an issue that is not waiting on a human", async () => {
		const { fake, context } = makeHarness()
		seedWorking(fake, 12)
		fake.files.set("answer.md", "Go.")

		const result = await failureOf(
			answer(["12", "--body", "answer.md", "--decision", "go"], context),
		)

		expect(result.code).toBe(1)
	})

	test("rejects an answer that carries the agent marker", async () => {
		const { fake, context } = makeHarness()
		seedWorking(fake, 12).labels = ["request", "autopilot", "stage:needs-you"]
		fake.files.set("answer.md", "Go.\n<!-- frontdesk:agent -->")

		expect(
			(await failureOf(answer(["12", "--body", "answer.md", "--decision", "go"], context))).code,
		).toBe(2)
	})

	describe("with card ids", () => {
		const answerCard = (id: string, text = "Go.", decision = "go") => {
			const { fake, context } = h
			fake.files.set("answer.md", text)

			return answer(["12", "--card", id, "--body", "answer.md", "--decision", decision], context)
		}
		let h: ReturnType<typeof makeHarness>

		beforeEach(() => {
			h = makeHarness()
		})

		test("answering_one_of_two_cards_does_not_requeue", async () => {
			seedParked(h.fake, 12, 2)

			await answerCard("c_first1-1", "Three.", "retries = 3")

			const issue = h.fake.issue(12)
			expect(issue.labels).toContain("stage:needs-you")
			expect(issue.labels).not.toContain("stage:ready")
			expect(issue.body).toContain("- 2026-10-16: retries = 3")

			const comments = parseComments(issue.comments)
			expect(activeClaims(comments)).toHaveLength(1)
			expect(comments.at(-1)).toMatchObject({
				body: "<!-- frontdesk:answer card=c_first1-1 -->\nThree.",
				agent: false,
			})
			expect(h.output.at(-1)).toContain("1 card still open")
		})

		test("the last card answered requeues the request and releases the claim", async () => {
			seedParked(h.fake, 12, 2)

			await answerCard("c_first1-1", "Three.", "retries = 3")
			await answerCard("c_first1-2", "Ten.", "timeout = 10")

			const issue = h.fake.issue(12)
			expect(issue.labels).toContain("stage:ready")
			expect(issue.body).toContain("- 2026-10-16: retries = 3\n- 2026-10-16: timeout = 10")
			expect(activeClaims(parseComments(issue.comments))).toHaveLength(0)
		})

		test("cards can be answered in either order", async () => {
			seedParked(h.fake, 12, 2)

			await answerCard("c_first1-2")
			expect(h.fake.issue(12).labels).toContain("stage:needs-you")

			await answerCard("c_first1-1", "Again.", "again")
			expect(h.fake.issue(12).labels).toContain("stage:ready")
		})

		test("a request whose owning claim is a frontman's returns to intake", async () => {
			seedParked(h.fake, 12, 1, "frontman")

			await answerCard("c_first1-1")

			const labels = h.fake.issue(12).labels
			expect(labels).toContain("stage:intake")
			expect(labels).not.toContain("stage:needs-you")
			expect(labels).not.toContain("stage:ready")
		})

		test("refuses without --card when two cards are open, and names them", async () => {
			seedParked(h.fake, 12, 2)
			h.fake.files.set("answer.md", "Go.")

			const result = await failureOf(
				answer(["12", "--body", "answer.md", "--decision", "go"], h.context),
			)

			expect(result.code).toBe(1)
			expect(result.message).toContain("c_first1-1")
			expect(result.message).toContain("c_first1-2")
			expect(h.fake.issue(12).comments).toHaveLength(3)
		})

		test("without --card the only open card is the one answered", async () => {
			seedParked(h.fake, 12, 1)
			h.fake.files.set("answer.md", "Go.")

			await answer(["12", "--body", "answer.md", "--decision", "go"], h.context)

			expect(h.fake.issue(12).comments.at(-2)?.body).toStartWith(
				"<!-- frontdesk:answer card=c_first1-1 -->",
			)
			expect(h.fake.issue(12).labels).toContain("stage:ready")
		})

		test("answer_after_the_frontman_claim_was_released_still_returns_to_intake", async () => {
			seedParked(h.fake, 12, 1, "frontman")
			h.fake.addComment(
				12,
				composeComment("release", { claim: "c_first1", reason: "no-worker" }, "x"),
			)

			await answerCard("c_first1-1")

			expect(h.fake.issue(12).labels).toContain("stage:intake")
			expect(h.fake.issue(12).labels).not.toContain("stage:ready")
		})

		test("rerun_without_card_after_the_last_answer_posts_nothing_twice", async () => {
			seedParked(h.fake, 12, 1)
			await answerCard("c_first1-1", "Go.", "go")
			h.fake.issue(12).labels = ["request", "autopilot", "stage:needs-you"]
			h.fake.files.set("answer.md", "Go.")

			await answer(["12", "--body", "answer.md", "--decision", "go"], h.context)

			const issue = h.fake.issue(12)
			expect(issue.comments.filter((comment) => comment.body.includes("Go."))).toHaveLength(1)
			expect(issue.body.match(/: go/g)).toHaveLength(1)
			expect(issue.labels).toContain("stage:ready")
		})

		test("a card from before card ids is answered by its synthetic id", async () => {
			h.fake.addIssue({ number: 12, labels: ["request", "autopilot", "stage:needs-you"] })
			h.fake.addComment(12, claimBody("c_first1"))
			const legacy = h.fake.addComment(
				12,
				composeComment("decision", { claim: "c_first1" }, "## Old card"),
			)

			await answerCard(`legacy-${legacy.databaseId}`)

			expect(h.fake.issue(12).labels).toContain("stage:ready")
		})

		test("refuses a card id that the newest park does not hold", async () => {
			seedParked(h.fake, 12, 1)

			const result = await failureOf(answerCard("c_other-1"))

			expect(result.code).toBe(1)
			expect(result.message).toContain("c_other-1")
			expect(h.fake.issue(12).comments).toHaveLength(2)
		})

		test("refuses a second, different answer to a card that is already answered", async () => {
			seedParked(h.fake, 12, 2)
			await answerCard("c_first1-1", "Three.", "retries = 3")

			const result = await failureOf(answerCard("c_first1-1", "Five.", "retries = 5"))

			expect(result.message).toContain("already answered")
			expect(h.fake.issue(12).body).not.toContain("retries = 5")
		})

		test("repeating the same answer posts and records nothing twice", async () => {
			seedParked(h.fake, 12, 2)
			await answerCard("c_first1-1", "Three.", "retries = 3")
			const comments = h.fake.issue(12).comments.length

			await answerCard("c_first1-1", "Three.", "retries = 3")

			expect(h.fake.issue(12).comments).toHaveLength(comments)
			expect(h.fake.issue(12).body.match(/retries = 3/g)).toHaveLength(1)
		})
	})
})
