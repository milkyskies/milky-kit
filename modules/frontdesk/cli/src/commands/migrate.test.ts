import { afterEach, describe, expect, test } from "bun:test"
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type { Gh } from "../github/gh.ts"
import { type FakeGithub, makeHarness } from "../github/testing/fake-gh.ts"
import { failureOf } from "../github/testing/seed.ts"
import { failed, ok } from "../preflight/testing/world.ts"
import type { Runner } from "../preflight/types.ts"
import { runMigrate } from "./migrate.ts"

const roots: string[] = []

afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

const OLD_MANIFEST =
	"cards.md\tmodules/core/rules/cards.md\nautopilot.md\tmodules/autopilot/rules/autopilot.md\nissues.md\tmodules/issues/rules/issues.md\n"
const NEW_MANIFEST =
	"cards.md\tmodules/core/rules/cards.md\nfrontdesk.md\tmodules/frontdesk/rules/frontdesk.md\nissues.md\tmodules/issues/rules/issues.md\n"

const OLD_CARD =
	"<!-- autopilot:decision -->\n## Decision needed\n\nQuestion?\n\n<!-- autopilot:agent -->\n"
const MIGRATED_CARD =
	"<!-- frontdesk:decision -->\n## Decision needed\n\nQuestion?\n\n<!-- frontdesk:agent -->\n"

function routesFor(
	fake: FakeGithub,
	options: { dropEdits?: boolean } = {},
): { gh: Gh; patched: number[] } {
	const patched: number[] = []

	const gh: Gh = async (args, input) => {
		if (args[0] === "issue" && args[1] === "list") {
			return JSON.stringify(
				[...fake.issues.values()]
					.filter((issue) => issue.state === "OPEN")
					.map((issue) => ({ number: issue.number })),
			)
		}

		const commentId = /issues\/comments\/(\d+)$/.exec(args.at(-3) ?? "")?.[1]
		if (args.includes("PATCH") && commentId !== undefined) {
			patched.push(Number(commentId))
			if (!options.dropEdits) {
				for (const issue of fake.issues.values()) {
					for (const comment of issue.comments) {
						if (comment.databaseId === Number(commentId))
							comment.body = JSON.parse(input ?? "{}").body
					}
				}
			}

			return "{}"
		}

		return fake.gh(args, input)
	}

	return { gh, patched }
}

async function setup(
	options: { manifest?: string; dropEdits?: boolean; mise?: ReturnType<typeof ok> } = {},
) {
	const root = await mkdtemp(join(tmpdir(), "frontdesk-migrate-"))
	roots.push(root)
	await mkdir(join(root, ".claude", "rules"), { recursive: true })
	await writeFile(join(root, ".claude", "rules.manifest"), options.manifest ?? OLD_MANIFEST)
	await symlink("/nowhere/autopilot.md", join(root, ".claude", "rules", "autopilot.md"))

	const { fake, context, output } = makeHarness()
	fake.addIssue({ number: 12, labels: ["request", "stage:needs-you"] })
	fake.addComment(12, OLD_CARD)
	fake.addComment(12, "My answer, mentioning <!-- autopilot:decision --> by hand")
	fake.addComment(
		12,
		"<!-- frontdesk:claim id=c_a machine=zeus task=t dispatch=d at=2026-10-16T14:02:00Z -->\nClaimed.\n\n<!-- frontdesk:agent -->\n",
	)
	fake.addIssue({ number: 13, labels: ["request", "stage:ready"] })
	fake.addComment(13, "<!-- autopilot:proposed-body -->\nA body\n\n<!-- autopilot:agent -->\n")
	fake.addIssue({ number: 14, state: "CLOSED", labels: ["request", "stage:done"] })
	fake.addComment(14, OLD_CARD)

	const routes = routesFor(fake, options)
	const calls: string[] = []
	const run: Runner = async (command, args) => {
		calls.push([command, ...args].join(" "))

		if (command === "git") return ok(`${root}\n`)

		return options.mise ?? ok("")
	}

	return {
		root,
		fake,
		context: { ...context, gh: routes.gh },
		output,
		run,
		calls,
		patched: routes.patched,
	}
}

describe("frontdesk migrate", () => {
	test("rewrites the manifest, drops the stale link, relinks, and moves every open issue's markers", async () => {
		const { root, fake, context, output, run, calls, patched } = await setup()

		await runMigrate([], context, { run, cwd: root })

		expect(await readFile(join(root, ".claude", "rules.manifest"), "utf8")).toBe(NEW_MANIFEST)
		expect(
			await lstat(join(root, ".claude", "rules", "autopilot.md")).catch(() => undefined),
		).toBeUndefined()
		expect(calls).toContain("mise run rules:link")
		expect(fake.issue(12).comments[0]?.body).toBe(MIGRATED_CARD)
		expect(fake.issue(13).comments[0]?.body).toBe(
			"<!-- frontdesk:proposed-body -->\nA body\n\n<!-- frontdesk:agent -->\n",
		)
		expect(fake.issue(14).comments[0]?.body).toBe(OLD_CARD)
		expect(patched).toHaveLength(2)
		expect(output).toContain("rewrite autopilot.md → frontdesk.md in .claude/rules.manifest")
		expect(output).toContain("remove the stale link .claude/rules/autopilot.md")
		expect(output).toContain("rewrite 2 autopilot markers to frontdesk in #12 comment 1001")
		expect(fake.issue(12).comments[1]?.body).toBe(
			"My answer, mentioning <!-- autopilot:decision --> by hand",
		)
		expect(output).toContain("rewrite 2 autopilot markers to frontdesk in #13 comment 1004")
	})

	test("--dry-run lists the manifest change and every comment, and changes nothing", async () => {
		const { root, fake, context, output, run, calls, patched } = await setup()
		const before = fake.issue(12).comments.map((comment) => comment.body)

		await runMigrate(["--dry-run"], context, { run, cwd: root })

		expect(await readFile(join(root, ".claude", "rules.manifest"), "utf8")).toBe(OLD_MANIFEST)
		expect((await lstat(join(root, ".claude", "rules", "autopilot.md"))).isSymbolicLink()).toBe(
			true,
		)
		expect(calls.filter((call) => call.startsWith("mise"))).toEqual([])
		expect(patched).toEqual([])
		expect(fake.issue(12).comments.map((comment) => comment.body)).toEqual(before)
		expect(output).toContain("would rewrite autopilot.md → frontdesk.md in .claude/rules.manifest")
		expect(output).toContain("would rewrite 2 autopilot markers to frontdesk in #12 comment 1001")
		expect(output).toContain("would rewrite 2 autopilot markers to frontdesk in #13 comment 1004")
		expect(output.at(-1)).toBe("dry run: nothing changed. 2 comments across open issues")
	})

	test("a second run finds nothing to do", async () => {
		const { root, context, output, run, patched } = await setup()
		await runMigrate([], context, { run, cwd: root })
		const editsAfterFirst = patched.length

		output.length = 0
		await runMigrate([], context, { run, cwd: root })

		expect(output).toEqual(["nothing to migrate"])
		expect(patched).toHaveLength(editsAfterFirst)
	})

	test("a manifest that already lists frontdesk.md just loses the old line", async () => {
		const manifest = `${OLD_MANIFEST}frontdesk.md\tmodules/frontdesk/rules/frontdesk.md\n`
		const { root, context, run } = await setup({ manifest })

		await runMigrate([], context, { run, cwd: root })

		expect(await readFile(join(root, ".claude", "rules.manifest"), "utf8")).toBe(
			"cards.md\tmodules/core/rules/cards.md\nissues.md\tmodules/issues/rules/issues.md\nfrontdesk.md\tmodules/frontdesk/rules/frontdesk.md\n",
		)
	})

	test("a failing mise run rules:link exits 3", async () => {
		const { root, context, calls } = await setup()
		const run: Runner = async (command, args) => {
			calls.push([command, ...args].join(" "))

			return command === "git" ? ok(`${root}\n`) : failed("no kit", 1)
		}

		const result = await failureOf(runMigrate([], context, { run, cwd: root }))

		expect(result.code).toBe(3)
		expect(result.message).toContain("mise run rules:link failed: no kit")
	})

	test("an edit that GitHub accepts but does not keep exits 4", async () => {
		const { root, context, run } = await setup({ dropEdits: true })

		const result = await failureOf(runMigrate([], context, { run, cwd: root }))

		expect(result.code).toBe(4)
	})

	test("a project without a manifest still migrates its issues", async () => {
		const { root, fake, context, run } = await setup()
		await rm(join(root, ".claude", "rules.manifest"))

		await runMigrate([], context, { run, cwd: root })

		expect(fake.issue(12).comments[0]?.body).toBe(MIGRATED_CARD)
	})
})
