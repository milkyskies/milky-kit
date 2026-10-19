import { describe, expect, test } from "bun:test"

import { readIssue } from "../github/issue.ts"
import { composeComment } from "../github/markers.ts"
import { claimBody, failureOf } from "../github/testing/seed.ts"
import { FakeShell, failed, ok } from "../merge/testing.ts"
import { FakeOrca } from "../orca/testing/fake-orca.ts"
import { collectDigest, pingedAt } from "../ping/digest.ts"
import { mergePingedAt } from "../ping/merged.ts"
import { SECTION, worker } from "../reconcile/testing/fixtures.ts"
import { makeListingHarness } from "../reconcile/testing/github.ts"
import { runWith } from "./merge.ts"

function setup(
	options: {
		workflows?: boolean
		check?: string
		labels?: string[]
		land?: "land:check" | "land:auto"
		reviewPaths?: string[]
		humanComment?: string | undefined
	} = {},
) {
	const harness = makeListingHarness()
	const fakeOrca = new FakeOrca()
	const shell = new FakeShell()
	const clock: { ms: number; onSleep: (() => void) | undefined } = { ms: 0, onSleep: undefined }
	const pings: string[] = []
	const ntfy = { status: 200 }
	const { fake } = harness

	fake.pullRequests.set(
		45,
		Object.assign(
			{
				number: 45,
				state: "OPEN" as const,
				isDraft: false,
				body: "closes #12",
				mergeable: "MERGEABLE" as const,
				headRefOid: "abc",
				baseRefName: "main",
				behindBy: 0,
			},
			{ headRefName: "feature/12" },
		),
	)
	fake.addIssue({
		number: 12,
		title: "Show the count on the badge",
		labels: ["request", "autopilot", "stage:check", ...(options.labels ?? [])],
		pullRequests: [45],
	})
	fake.addComment(12, claimBody("c_1", "ctx_y"))
	fake.addComment(
		12,
		composeComment(
			"result",
			{ claim: "c_1", pr: "45" },
			"## Done, check it\n\nThe badge now shows the unread count.\n\n**Worker says:** fine",
		),
	)
	if ("humanComment" in options) {
		if (options.humanComment !== undefined) fake.addComment(12, options.humanComment)
	} else fake.addComment(12, "Looks good, merge it")
	fakeOrca.workers = [worker()]

	const deps = {
		orca: fakeOrca.orca,
		loadSection: async () => ({
			...SECTION,
			coordinator: {
				...SECTION.coordinator,
				check: options.check ?? SECTION.coordinator.check,
				land: options.land ?? SECTION.coordinator.land,
			},
			reviewPaths: options.reviewPaths ?? [],
		}),
		shell: shell.shell,
		hasWorkflows: async () => options.workflows ?? false,
		sleep: async (milliseconds: number) => {
			clock.ms += milliseconds
			clock.onSleep?.()
		},
		nowMs: () => clock.ms,
		ping: {
			loadEnv: async () => ({
				FRONTDESK_NTFY_URL: "http://ceres:8091",
				FRONTDESK_NTFY_TOPIC: "abc123",
			}),
			post: async (_url: string, _headers: Record<string, string>, body: string) => {
				pings.push(body)

				return ntfy.status
			},
		},
	}

	return { ...harness, fakeOrca, shell, deps, clock, pings, ntfy }
}

describe("frontdesk merge", () => {
	test("refuses without a looks good comment newer than the result, and touches nothing", async () => {
		const { fake, context, shell, deps } = setup()
		fake.issue(12).comments.pop()
		fake.addComment(12, "can you rename it first?")

		const failure = await failureOf(runWith(deps, ["12"], context))

		expect(failure.code).toBe(1)
		expect(failure.message).toContain("looks good")
		expect(shell.calls).toHaveLength(0)
		expect(fake.issue(12).labels).toContain("stage:check")
	})

	test("refuses a looks good that is older than the result", async () => {
		const { fake, context, deps } = setup()
		const comments = fake.issue(12).comments
		fake.issue(12).comments = [comments[0], comments[2], comments[1]].filter(
			(comment) => comment !== undefined,
		)

		expect((await failureOf(runWith(deps, ["12"], context))).code).toBe(1)
	})

	test("refuses on a conflict with main, names the files, pushes and merges nothing", async () => {
		const { fake, context, shell, deps } = setup()
		shell.on("git merge origin/main", failed("CONFLICT (content)"))
		shell.on("git diff --name-only", { code: 0, stdout: "src/a.ts\nsrc/b.ts\n", stderr: "" })

		const failure = await failureOf(runWith(deps, ["12"], context))

		expect(failure.code).toBe(1)
		expect(failure.message).toContain("src/a.ts, src/b.ts")
		expect(shell.called("git push")).toHaveLength(0)
		expect(shell.called("git merge --abort")).toHaveLength(1)
		expect(shell.called("git worktree remove")).not.toHaveLength(0)
		expect(fake.callsMatching(["pr", "merge"])).toHaveLength(0)
	})

	test("refuses when the local check fails and reports the first failing line", async () => {
		const { context, shell, deps } = setup({ check: "bun test" })
		shell.on("sh -c bun test", failed("running\n1 fail: parser rejects empty input\n"))

		const failure = await failureOf(runWith(deps, ["12"], context))

		expect(failure.code).toBe(1)
		expect(failure.message).toContain("1 fail: parser rejects empty input")
		expect(shell.called("git push")).toHaveLength(0)
	})

	test("runs the check command from the ## frontdesk section", async () => {
		const configured = setup({ check: "bun test" })
		await runWith(configured.deps, ["12"], configured.context)
		expect(configured.shell.called("sh -c bun test")).toHaveLength(1)

		const standard = setup()
		await runWith(standard.deps, ["12"], standard.context)
		expect(standard.shell.called("sh -c mise run check")).toHaveLength(1)
	})

	test("merges with a merge commit, reports no CI configured, and never reads checks", async () => {
		const { fake, context, output, shell, deps } = setup()

		await runWith(deps, ["12"], context)

		expect(output[0]).toContain("no CI configured")
		expect(fake.callsMatching(["pr", "merge", "45"])[0]).toContain("--merge")
		expect(fake.callsMatching(["pr", "checks"])).toHaveLength(0)
		expect(fake.calls.some((call) => call.join(" ").includes("check-runs"))).toBe(false)
		expect(shell.called("git push origin HEAD:feature/12")).toHaveLength(1)

		const mergeComment = fake
			.issue(12)
			.comments.find((comment) => comment.body.startsWith("<!-- frontdesk:merge"))
		expect(mergeComment?.body).toStartWith("<!-- frontdesk:merge pr=45 ci=none check=passed -->")
		expect(fake.issue(12).labels).toContain("stage:done")
		expect(fake.issue(12).state).toBe("CLOSED")
	})

	test("reports CI blocked when the failing run was never started because of billing", async () => {
		const { context, output, extras, deps } = setup({ workflows: true })
		extras.checkRuns = [{ id: 7, name: "ci", status: "completed", conclusion: "failure" }]
		extras.annotations.set(7, [
			{ message: "The job was not started because your account is locked due to a billing issue." },
		])

		await runWith(deps, ["12"], context)

		expect(output[0]).toContain("CI blocked")
	})

	test("reports CI blocked when Actions is disabled", async () => {
		const { fake, context, output, extras, deps } = setup({ workflows: true })
		extras.actionsEnabled = false

		await runWith(deps, ["12"], context)

		expect(output[0]).toContain("CI blocked")
		expect(fake.issue(12).comments.some((comment) => comment.body.includes("ci=blocked"))).toBe(
			true,
		)
	})

	test("refuses when configured CI is failing for a real reason", async () => {
		const { fake, context, extras, deps } = setup({ workflows: true })
		extras.checkRuns = [{ id: 8, name: "ci", status: "completed", conclusion: "failure" }]
		extras.annotations.set(8, [{ message: "Process completed with exit code 1." }])

		const failure = await failureOf(runWith(deps, ["12"], context))

		expect(failure.code).toBe(1)
		expect(failure.message).toContain("CI failing (ci)")
		expect(fake.callsMatching(["pr", "merge"])).toHaveLength(0)
	})

	test("waits for CI that is still running, then merges once it passes", async () => {
		const { context, output, extras, clock, deps } = setup({ workflows: true })
		extras.checkRuns = [{ id: 9, name: "ci", status: "in_progress", conclusion: null }]
		clock.onSleep = () => {
			extras.checkRuns = [{ id: 9, name: "ci", status: "completed", conclusion: "success" }]
		}

		await runWith(deps, ["12"], context)

		expect(clock.ms).toBe(20_000)
		expect(output[0]).toContain("CI passed")
	})

	test("refuses when a started CI run never finishes within the timeout, and merges nothing", async () => {
		const { fake, context, extras, clock, deps } = setup({ workflows: true })
		extras.checkRuns = [{ id: 9, name: "ci", status: "in_progress", conclusion: null }]

		const failure = await failureOf(runWith(deps, ["12", "--ci-timeout", "5m"], context))

		expect(failure.code).toBe(1)
		expect(failure.message).toContain("did not finish within 5 minutes")
		expect(clock.ms).toBeGreaterThanOrEqual(300_000)
		expect(fake.callsMatching(["pr", "merge"])).toHaveLength(0)
	})

	test("treats a commit that no workflow ran for as no CI for this change, after a short grace", async () => {
		const { fake, context, output, clock, deps } = setup({ workflows: true })

		await runWith(deps, ["12"], context)

		expect(clock.ms).toBe(120_000)
		expect(output[0]).toContain("no CI ran for this change")
		expect(fake.issue(12).comments.some((comment) => comment.body.includes("ci=none"))).toBe(true)
	})

	test("a run that appears during the grace period is waited on, not skipped", async () => {
		const { context, output, extras, clock, deps } = setup({ workflows: true })
		clock.onSleep = () => {
			extras.checkRuns = [{ id: 9, name: "ci", status: "completed", conclusion: "success" }]
		}

		await runWith(deps, ["12"], context)

		expect(output[0]).toContain("CI passed")
	})

	test("refuses when CI fails while it is being waited on", async () => {
		const { fake, context, extras, clock, deps } = setup({ workflows: true })
		extras.checkRuns = [{ id: 9, name: "ci", status: "queued", conclusion: null }]
		extras.annotations.set(9, [{ message: "Process completed with exit code 1." }])
		clock.onSleep = () => {
			extras.checkRuns = [{ id: 9, name: "ci", status: "completed", conclusion: "failure" }]
		}

		const failure = await failureOf(runWith(deps, ["12"], context))

		expect(failure.message).toContain("CI failing (ci)")
		expect(fake.callsMatching(["pr", "merge"])).toHaveLength(0)
	})

	test("refuses when a human comments no during the local check", async () => {
		const { fake, context, shell, deps } = setup()
		shell.on("sh -c", () => {
			fake.addComment(12, "no, because the count should start at 0")

			return { code: 0, stdout: "", stderr: "" }
		})

		const failure = await failureOf(runWith(deps, ["12"], context))

		expect(failure.code).toBe(1)
		expect(fake.callsMatching(["pr", "merge"])).toHaveLength(0)
		expect(fake.issue(12).labels).toContain("stage:check")
	})

	test("merges only the commit that passed the check", async () => {
		const { fake, context, deps } = setup()

		await runWith(deps, ["12"], context)

		const [call] = fake.callsMatching(["pr", "merge", "45"])
		expect(call?.slice(call.indexOf("--match-head-commit"))).toEqual([
			"--match-head-commit",
			"sha123",
		])
	})

	test("lands the issue: the worker is released after the merge", async () => {
		const { context, fakeOrca, deps } = setup()

		await runWith(deps, ["12"], context)

		expect(fakeOrca.called("worker-release", "ctx_y")).toHaveLength(1)
	})

	describe("per-request landing", () => {
		const auto = { labels: ["land:auto"], humanComment: undefined }

		function autoComments(fake: { issue: (n: number) => { comments: { body: string }[] } }) {
			return fake
				.issue(12)
				.comments.filter((comment) => comment.body.startsWith("<!-- frontdesk:autoland"))
		}

		test("auto_land_merges_when_checks_pass", async () => {
			const { fake, context, shell, fakeOrca, deps } = setup(auto)

			await runWith(deps, ["12"], context)

			expect(shell.called("git merge origin/main")).toHaveLength(1)
			expect(shell.called("sh -c mise run check")).toHaveLength(1)
			expect(fake.callsMatching(["pr", "merge", "45"])).toHaveLength(1)
			expect(fake.issue(12).labels).toContain("stage:done")
			expect(fake.issue(12).state).toBe("CLOSED")
			expect(fakeOrca.called("worker-release", "ctx_y")).toHaveLength(1)

			const mergeComment = fake
				.issue(12)
				.comments.find((comment) => comment.body.startsWith("<!-- frontdesk:merge"))
			expect(mergeComment?.body).toStartWith(
				"<!-- frontdesk:merge pr=45 ci=none check=passed by=auto -->",
			)
		})

		test("auto_merge_pings_once", async () => {
			const { fake, context, pings, deps } = setup(auto)

			await runWith(deps, ["12"], context)

			expect(pings).toEqual([
				"kit: merged #12 Show the count on the badge\nThe badge now shows the unread count.\nhttps://github.com/milkyskies/kit/pull/45",
			])

			const mergeComment = fake
				.issue(12)
				.comments.find((comment) => comment.body.startsWith("<!-- frontdesk:merge"))
			expect(mergeComment && mergePingedAt(mergeComment.body)).toBeDefined()

			await failureOf(runWith(deps, ["12"], context))

			expect(pings).toHaveLength(1)
		})

		test("auto_merge_still_appears_in_digest", async () => {
			const { fake, context, deps } = setup(auto)

			await runWith(deps, ["12"], context)

			const issue = await readIssue(context.gh, context.repo, 12)
			const digest = collectDigest([issue], new Date())

			expect(digest.autoMerged.map((merged) => merged.issue)).toEqual([12])

			const mergeComment = fake
				.issue(12)
				.comments.find((comment) => comment.body.startsWith("<!-- frontdesk:merge"))
			expect(mergeComment && pingedAt(mergeComment.body)).toBeUndefined()
		})

		test("a human merge sends no merge ping", async () => {
			const { context, pings, deps } = setup()

			await runWith(deps, ["12"], context)

			expect(pings).toHaveLength(0)
		})

		test("a blocked auto landing sends no merge ping", async () => {
			const { context, pings, shell, deps } = setup({ ...auto, check: "bun test" })
			shell.on("sh -c bun test", failed("1 fail\n"))

			await runWith(deps, ["12"], context)

			expect(pings).toHaveLength(0)
		})

		test("an unreachable ntfy leaves the merge landed and the comment unmarked for the digest", async () => {
			const { fake, context, ntfy, deps } = setup(auto)
			ntfy.status = 503

			await runWith(deps, ["12"], context)

			expect(fake.issue(12).state).toBe("CLOSED")

			const mergeComment = fake
				.issue(12)
				.comments.find((comment) => comment.body.startsWith("<!-- frontdesk:merge"))
			expect(mergeComment && mergePingedAt(mergeComment.body)).toBeUndefined()
		})

		test("auto_land_waits_for_milky_when_check_command_fails", async () => {
			const { fake, context, output, shell, deps } = setup({ ...auto, check: "bun test" })
			shell.on("sh -c bun test", failed("1 fail: parser rejects empty input\n"))

			await runWith(deps, ["12"], context)

			expect(fake.callsMatching(["pr", "merge"])).toHaveLength(0)
			expect(shell.called("git push")).toHaveLength(0)
			expect(fake.issue(12).labels).toContain("stage:check")
			expect(fake.issue(12).state).toBe("OPEN")

			const comments = autoComments(fake)
			expect(comments).toHaveLength(1)
			expect(comments[0]?.body).toStartWith(
				"<!-- frontdesk:autoland pr=45 blocked=check head=abc -->",
			)
			expect(comments[0]?.body).toContain("bun test")
			expect(comments[0]?.body).toContain("1 fail: parser rejects empty input")
			expect(output[0]).toContain("waits for a human")
		})

		test("auto_land_waits_when_review_path_has_no_clean_review", async () => {
			const { fake, context, shell, deps } = setup({ ...auto, reviewPaths: ["db/migrations/**"] })
			shell.on("git diff --name-only origin/main HEAD", {
				code: 0,
				stdout: "src/a.ts\ndb/migrations/001.sql\n",
				stderr: "",
			})

			await runWith(deps, ["12"], context)

			expect(fake.callsMatching(["pr", "merge"])).toHaveLength(0)
			expect(shell.called("git push")).toHaveLength(0)
			expect(fake.issue(12).labels).toContain("stage:check")
			expect(autoComments(fake)).toHaveLength(1)
			expect(autoComments(fake)[0]?.body).toStartWith(
				"<!-- frontdesk:autoland pr=45 blocked=review head=abc -->",
			)
		})

		test("auto_land_waits_when_the_newest_review_has_a_blocking_finding", async () => {
			const { fake, context, shell, deps } = setup({ ...auto, reviewPaths: ["db/migrations/**"] })
			shell.on("git diff --name-only origin/main HEAD", ok("db/migrations/001.sql\n"))
			fake.addComment(12, composeComment("review", { pr: "45", verdict: "clean" }, "Fine."))
			fake.addComment(
				12,
				composeComment("review", { pr: "45", verdict: "blocking" }, "Drops a column."),
			)

			await runWith(deps, ["12"], context)

			expect(fake.callsMatching(["pr", "merge"])).toHaveLength(0)
			expect(autoComments(fake)).toHaveLength(1)
		})

		test("auto_land_merges_when_review_path_has_a_clean_review_newer_than_the_result", async () => {
			const { fake, context, shell, deps } = setup({ ...auto, reviewPaths: ["db/migrations/**"] })
			shell.on("git diff --name-only origin/main HEAD", ok("db/migrations/001.sql\n"))
			fake.addComment(
				12,
				composeComment("review", { pr: "45", verdict: "clean" }, "No blocking findings."),
			)

			await runWith(deps, ["12"], context)

			expect(fake.callsMatching(["pr", "merge", "45"])).toHaveLength(1)
		})

		test("a diff outside every review path needs no review", async () => {
			const { fake, context, shell, deps } = setup({ ...auto, reviewPaths: ["db/migrations/**"] })
			shell.on("git diff --name-only origin/main HEAD", ok("src/a.ts\n"))

			await runWith(deps, ["12"], context)

			expect(fake.callsMatching(["pr", "merge", "45"])).toHaveLength(1)
		})

		test("auto_land_waits_on_a_conflict_with_main", async () => {
			const { fake, context, shell, deps } = setup(auto)
			shell.on("git merge origin/main", failed("CONFLICT (content)"))
			shell.on("git diff --name-only --diff-filter=U", ok("src/a.ts\n"))

			await runWith(deps, ["12"], context)

			expect(fake.callsMatching(["pr", "merge"])).toHaveLength(0)
			expect(autoComments(fake)[0]?.body).toStartWith(
				"<!-- frontdesk:autoland pr=45 blocked=merge head=abc -->",
			)
			expect(autoComments(fake)[0]?.body).toContain("src/a.ts")
		})

		test("a human comment during the checks stops an auto landing, and merges nothing", async () => {
			const { fake, context, shell, deps } = setup(auto)
			shell.on("sh -c", () => {
				fake.addComment(12, "wait, the count should start at 0")

				return ok("")
			})

			expect((await failureOf(runWith(deps, ["12"], context))).code).toBe(1)
			expect(fake.callsMatching(["pr", "merge"])).toHaveLength(0)
		})

		test("a land:auto request with a human comment other than looks good is refused", async () => {
			const { context, shell, deps } = setup({ ...auto, humanComment: "can you rename it first?" })

			expect((await failureOf(runWith(deps, ["12"], context))).code).toBe(1)
			expect(shell.calls).toHaveLength(0)
		})

		test("a land:check request with no human comment is refused and touches nothing", async () => {
			const { context, shell, deps } = setup({ labels: ["land:check"], humanComment: undefined })

			expect((await failureOf(runWith(deps, ["12"], context))).code).toBe(1)
			expect(shell.calls).toHaveLength(0)
		})

		test("missing_label_uses_project_default", async () => {
			const byDefault = setup({ land: "land:auto", humanComment: undefined })
			await runWith(byDefault.deps, ["12"], byDefault.context)
			expect(byDefault.fake.callsMatching(["pr", "merge", "45"])).toHaveLength(1)

			const overridden = setup({
				land: "land:auto",
				labels: ["land:check"],
				humanComment: undefined,
			})
			expect((await failureOf(runWith(overridden.deps, ["12"], overridden.context))).code).toBe(1)

			const unconfigured = setup({ humanComment: undefined })
			expect((await failureOf(runWith(unconfigured.deps, ["12"], unconfigured.context))).code).toBe(
				1,
			)
			expect(unconfigured.fake.callsMatching(["pr", "merge"])).toHaveLength(0)
		})

		test("a clean review that arrives after a blocked=review attempt lets the request land", async () => {
			const { fake, context, shell, deps } = setup({ ...auto, reviewPaths: ["db/migrations/**"] })
			shell.on("git diff --name-only origin/main HEAD", ok("db/migrations/001.sql\n"))
			await runWith(deps, ["12"], context)
			expect(fake.callsMatching(["pr", "merge"])).toHaveLength(0)

			fake.addComment(12, composeComment("review", { pr: "45", verdict: "clean" }, "Fine."))
			await runWith(deps, ["12"], context)

			expect(fake.callsMatching(["pr", "merge", "45"])).toHaveLength(1)
		})

		test("a second auto attempt after a blocked one for the same result is refused and touches nothing", async () => {
			const { fake, context, shell, deps } = setup({ ...auto, check: "bun test" })
			shell.on("sh -c bun test", failed("1 fail\n"))
			await runWith(deps, ["12"], context)
			shell.calls.length = 0

			expect((await failureOf(runWith(deps, ["12"], context))).code).toBe(1)
			expect(shell.calls).toHaveLength(0)
			expect(autoComments(fake)).toHaveLength(1)
		})

		test("a new push to the pull request after a blocked attempt tries again", async () => {
			const { fake, context, shell, deps } = setup({ ...auto, check: "bun test" })
			shell.on("sh -c bun test", failed("1 fail\n"))
			await runWith(deps, ["12"], context)
			expect(fake.callsMatching(["pr", "merge"])).toHaveLength(0)

			shell.on("sh -c bun test", ok(""))
			const pushed = fake.pullRequests.get(45)
			if (pushed) pushed.headRefOid = "def"
			await runWith(deps, ["12"], context)

			expect(fake.callsMatching(["pr", "merge", "45"])).toHaveLength(1)
			expect(autoComments(fake)).toHaveLength(1)
		})

		test("a block after the merge commit was pushed records the pushed head, so that push earns no retry", async () => {
			const { fake, context, extras, shell, deps } = setup({ ...auto, workflows: true })
			extras.checkRuns = [{ id: 8, name: "ci", status: "completed", conclusion: "failure" }]
			extras.annotations.set(8, [{ message: "Process completed with exit code 1." }])
			await runWith(deps, ["12"], context)
			expect(autoComments(fake)[0]?.body).toStartWith(
				"<!-- frontdesk:autoland pr=45 blocked=ci head=sha123 -->",
			)

			const pushed = fake.pullRequests.get(45)
			if (pushed) pushed.headRefOid = "sha123"
			shell.calls.length = 0

			expect((await failureOf(runWith(deps, ["12"], context))).code).toBe(1)
			expect(shell.calls).toHaveLength(0)
		})

		test("a block that recorded no head keeps holding after a push", async () => {
			const { fake, context, shell, deps } = setup(auto)
			fake.addComment(
				12,
				composeComment("autoland", { pr: "45", blocked: "check" }, "Not landed automatically."),
			)
			const pushed = fake.pullRequests.get(45)
			if (pushed) pushed.headRefOid = "def"

			const failure = await failureOf(runWith(deps, ["12"], context))

			expect(failure.code).toBe(1)
			expect(failure.message).toContain("a new push to the pull request")
			expect(shell.calls).toHaveLength(0)
		})

		test("a label removed during the checks stops the landing and merges nothing", async () => {
			const { fake, context, shell, deps } = setup(auto)
			shell.on("sh -c", () => {
				fake.issue(12).labels = fake.issue(12).labels.filter((label) => label !== "land:auto")

				return ok("")
			})

			expect((await failureOf(runWith(deps, ["12"], context))).code).toBe(1)
			expect(fake.callsMatching(["pr", "merge"])).toHaveLength(0)
		})

		test("a new result naming another pull request during the checks stops the landing", async () => {
			const { fake, context, shell, deps } = setup(auto)
			shell.on("sh -c", () => {
				fake.addComment(12, composeComment("result", { claim: "c_1", pr: "46" }, "## Done again"))

				return ok("")
			})

			expect((await failureOf(runWith(deps, ["12"], context))).code).toBe(1)
			expect(fake.callsMatching(["pr", "merge"])).toHaveLength(0)
		})

		test("a head that moved before the merge leaves the request at check with one comment", async () => {
			const { fake, context, extras, deps } = setup(auto)
			extras.failMerge = true

			await runWith(deps, ["12"], context)

			expect(fake.issue(12).labels).toContain("stage:check")
			expect(autoComments(fake)).toHaveLength(1)
			expect(autoComments(fake)[0]?.body).toStartWith(
				"<!-- frontdesk:autoland pr=45 blocked=error head=sha123 -->",
			)
		})

		test("a draft pull request leaves the request at check and runs no check", async () => {
			const { fake, context, shell, deps } = setup(auto)
			const draft = fake.pullRequests.get(45)
			if (draft) draft.isDraft = true

			await runWith(deps, ["12"], context)

			expect(shell.called("sh -c")).toHaveLength(0)
			expect(autoComments(fake)[0]?.body).toStartWith(
				"<!-- frontdesk:autoland pr=45 blocked=merge head=abc -->",
			)
		})

		test("a result naming a pull request that does not close this issue is not merged", async () => {
			const { fake, context, shell, deps } = setup(auto)
			fake.issue(12).comments = fake
				.issue(12)
				.comments.map((comment) => ({ ...comment, body: comment.body.replace("pr=45", "pr=99") }))

			await runWith(deps, ["12"], context)

			expect(shell.called("git fetch")).toHaveLength(0)
			expect(fake.callsMatching(["pr", "merge"])).toHaveLength(0)
			expect(autoComments(fake)[0]?.body).toStartWith(
				"<!-- frontdesk:autoland pr=99 blocked=merge -->",
			)
		})

		test("a human looks good merges a pull request that GitHub does not list as closing the issue", async () => {
			const { fake, context, deps } = setup({ humanComment: "looks good" })
			fake.issue(12).pullRequests = []

			const failure = await failureOf(runWith(deps, ["12"], context))

			expect(fake.callsMatching(["pr", "merge", "45"])).toHaveLength(1)
			expect(failure.message).toContain("land #12")
		})

		test("a check that outlives its timeout blocks the landing and names the timeout", async () => {
			const { fake, context, shell, deps } = setup(auto)
			shell.on("sh -c", { code: 143, stdout: "", stderr: "", timedOut: true })

			await runWith(deps, ["12", "--check-timeout", "5m"], context)

			expect(autoComments(fake)[0]?.body).toContain("timed out after 5 minutes")
			expect(shell.called("git push")).toHaveLength(0)
		})

		test("the check runs with the check timeout", async () => {
			const { context, shell, deps } = setup(auto)

			await runWith(deps, ["12"], context)

			expect(shell.called("sh -c")[0]?.timeoutMs).toBe(20 * 60_000)
		})
	})
})
