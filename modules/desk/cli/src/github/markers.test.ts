import { describe, expect, test } from "bun:test"
import { appendToSection, sectionLines } from "./body.ts"
import {
	activeClaims,
	attemptCount,
	lastHumanComment,
	owningClaim,
	parseComments,
} from "./derive.ts"
import { composeComment, formatMarker, isAgentBody, parseMarker } from "./markers.ts"

function comment(databaseId: number, body: string) {
	return { id: `IC_${databaseId}`, databaseId, body, createdAt: "2026-10-16T14:00:00Z" }
}

const claim = (id: string) =>
	comment(
		Number(id.replace(/\D/g, "")),
		composeComment(
			"claim",
			{ id, machine: "zeus", task: "t", dispatch: "d", at: "2026-10-16T14:02:00Z" },
			"c",
		),
	)

describe("marker grammar", () => {
	test("a formatted marker parses back to its kind and attributes", () => {
		const marker = parseMarker(
			`${formatMarker("release", { claim: "c_1", reason: "no-worker" })}\nbody`,
		)

		expect(marker).toEqual({ kind: "release", attrs: { claim: "c_1", reason: "no-worker" } })
	})

	test("a marker value with a space is refused", () => {
		expect(() => formatMarker("claim", { machine: "my mac" })).toThrow()
	})

	test("a comment is the human's unless it carries the agent marker", () => {
		expect(isAgentBody(composeComment("claim", {}, "x"))).toBe(true)
		expect(isAgentBody("looks good")).toBe(false)
	})
})

describe("derived values", () => {
	test("the newest claim skips claims that a later release names", () => {
		const comments = parseComments([
			claim("c_1"),
			comment(2, composeComment("release", { claim: "c_1", reason: "no-worker" }, "r")),
			claim("c_3"),
		])

		expect(owningClaim(comments)?.id).toBe("c_3")
		expect(activeClaims(comments).map((entry) => entry.id)).toEqual(["c_3"])
	})

	test("a failed comment also closes its claim", () => {
		const comments = parseComments([
			claim("c_1"),
			comment(2, composeComment("failed", { claim: "c_1", attempt: "1" }, "no")),
		])

		expect(owningClaim(comments)).toBeUndefined()
	})

	test("a human comment resets the attempt count", () => {
		const release = (id: number, claimId: string) =>
			comment(id, composeComment("release", { claim: claimId, reason: "stopped" }, "r"))
		const comments = parseComments([
			claim("c_1"),
			release(2, "c_1"),
			claim("c_3"),
			release(4, "c_3"),
		])
		expect(attemptCount(comments)).toBe(2)

		const answered = parseComments([
			...comments.map(({ id, databaseId, body, createdAt }) => ({
				id,
				databaseId,
				body,
				createdAt,
			})),
			comment(5, "go ahead"),
		])
		expect(attemptCount(answered)).toBe(0)
		expect(lastHumanComment(answered)?.body).toBe("go ahead")
	})

	test("a release with reason answered does not count as an attempt", () => {
		const comments = parseComments([
			claim("c_1"),
			comment(2, "the answer"),
			comment(3, composeComment("release", { claim: "c_1", reason: "answered" }, "r")),
		])

		expect(attemptCount(comments)).toBe(0)
	})
})

describe("body sections", () => {
	test("appending creates a missing section at the end", () => {
		const body = appendToSection(
			"## Problem\n\nText.\n",
			"Small calls",
			"- 2026-10-16: Auto-decided: a over b because c",
		)

		expect(body).toBe(
			"## Problem\n\nText.\n\n## Small calls\n\n- 2026-10-16: Auto-decided: a over b because c\n",
		)
	})

	test("appending extends an existing section without touching the next one", () => {
		const start = "## Small calls\n\n- one\n\n## Tests\n\n- t\n"
		const body = appendToSection(start, "Small calls", "- two")

		expect(sectionLines(body, "Small calls")).toEqual(["- one", "- two"])
		expect(body).toContain("## Tests\n\n- t\n")
	})
})
