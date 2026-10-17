import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { DESK_SECTION } from "../preflight/testing/world.ts"
import {
	landingOf,
	parseDeskSection,
	readDeskSection,
	remoteMachines,
	workerMachines,
} from "./section.ts"

function parsed(markdown: string) {
	const result = parseDeskSection(markdown)
	if (result.kind !== "ok") throw new Error(`expected ok, got ${JSON.stringify(result)}`)

	return result.section
}

describe("parseDeskSection", () => {
	test("reads coordinator, machines and preflight from the format in the design", () => {
		const section = parsed(DESK_SECTION)

		expect(section.coordinator).toEqual({
			machine: "Minerva",
			ask: "ask:choices",
			check: "mise run check",
			land: "land:check",
		})
		expect(section.machines).toEqual([
			{ name: "Minerva", workers: 3, repo: undefined },
			{ name: "zeus", workers: 2, repo: "~/Code/Projects/kansai-2" },
		])
		expect(section.preflight.needs).toEqual([
			{ command: "pg_isready -h localhost -p 5432", fix: "docker compose up -d db" },
		])
		expect(section.preflight.mcp).toEqual(["serena", "blender"])
		expect(remoteMachines(section).map((machine) => machine.name)).toEqual(["zeus"])
	})

	test("the shipped template parses", () => {
		const template = readFileSync(
			join(import.meta.dir, "..", "..", "..", "desk-section.md"),
			"utf8",
		)

		expect(parsed(template).coordinator.ask).toBe("ask:choices")
	})

	test("check defaults to mise run check and no Machines means the coordinator machine with 3 workers", () => {
		const section = parsed("## desk\n\n### Coordinator\n- machine: Minerva\n- ask: ask:own-feel\n")

		expect(section.coordinator.check).toBe("mise run check")
		expect(section.coordinator.land).toBe("land:check")
		expect(section.reviewPaths).toEqual([])
		expect(workerMachines(section)).toEqual([{ name: "Minerva", workers: 3, repo: undefined }])
		expect(remoteMachines(section)).toEqual([])
	})

	test("reads the landing default and the review path globs", () => {
		const section = parsed(
			[
				"## desk",
				"### Coordinator",
				"- machine: Minerva",
				"- ask: ask:choices",
				"- land: land:auto",
				"### Review paths",
				"<!-- a comment is skipped -->",
				"- `apps/api/drizzle/migrations/**`",
				"- `scripts/**/*.sh` - kills processes",
			].join("\n"),
		)

		expect(section.coordinator.land).toBe("land:auto")
		expect(section.reviewPaths).toEqual(["apps/api/drizzle/migrations/**", "scripts/**/*.sh"])
	})

	test("a land value that is not a landing label, and a review path without a glob, name their line", () => {
		const result = parseDeskSection(
			[
				"## desk",
				"### Coordinator",
				"- machine: Minerva",
				"- ask: ask:choices",
				"- land: sometimes",
				"### Review paths",
				"- migrations",
			].join("\n"),
		)

		if (result.kind !== "invalid") throw new Error("expected invalid")

		expect(result.issues.map((issue) => issue.line)).toEqual([2, 7])
	})

	test("landingOf takes the request label, falls back to the default, and treats both labels as land:check", () => {
		const auto = parsed(
			"## desk\n### Coordinator\n- machine: M\n- ask: ask:choices\n- land: land:auto\n",
		)
		const plain = parsed("## desk\n### Coordinator\n- machine: M\n- ask: ask:choices\n")

		expect(landingOf(["request"], auto)).toBe("land:auto")
		expect(landingOf(["land:check"], auto)).toBe("land:check")
		expect(landingOf(["land:auto"], plain)).toBe("land:auto")
		expect(landingOf(["request"], plain)).toBe("land:check")
		expect(landingOf(["land:auto", "land:check"], auto)).toBe("land:check")
	})

	test("reports a missing section", () => {
		expect(parseDeskSection("# project\n\n## other\n")).toEqual({ kind: "missing" })
	})

	test("a ## desk heading inside a code fence is not the section", () => {
		expect(parseDeskSection("```md\n## desk\n### Coordinator\n```\n").kind).toBe("missing")
	})

	test("the section ends at the next ## heading, so later sections are not read", () => {
		const section = parsed(`${DESK_SECTION}\n## Other\n\n### Coordinator\n- bogus: 1\n`)

		expect(section.coordinator.machine).toBe("Minerva")
	})

	test("unknown keys, bad machine lines and fix-less commands each name their line", () => {
		const result = parseDeskSection(
			[
				"## desk",
				"### Coordinator",
				"- machine: Minerva",
				"- ask: ask:sometimes",
				"- colour: red",
				"### Machines",
				"- zeus: workers many",
				"- hera: workers 2, cpu 4",
				"### Preflight",
				"- `docker ps`",
				"- nonsense",
			].join("\n"),
		)

		if (result.kind !== "invalid") throw new Error("expected invalid")

		expect(result.issues.map((issue) => issue.line)).toEqual([2, 5, 7, 8, 10, 11])
		expect(result.issues[1]?.message).toBe('unknown key "colour" in ### Coordinator')
	})

	test("prose subsections such as Hard areas and Routing are not parsed", () => {
		const section = parsed(
			`${DESK_SECTION}\n### Hard areas\n- anything: goes here\n\n### Routing\n| Work | Model |\n`,
		)

		expect(section.coordinator.machine).toBe("Minerva")
	})
})

describe("readDeskSection", () => {
	test("reads the section from a file and throws an error naming the bad line", async () => {
		const directory = await mkdtemp(join(tmpdir(), "desk-section-"))
		const path = join(directory, "CLAUDE.md")

		try {
			await writeFile(path, DESK_SECTION)
			expect((await readDeskSection(path)).coordinator.machine).toBe("Minerva")

			await writeFile(path, DESK_SECTION.replace("- ask: ask:choices\n", ""))
			await expect(readDeskSection(path)).rejects.toThrow("### Coordinator needs ask set to one of")

			await writeFile(path, "# project\n")
			await expect(readDeskSection(path)).rejects.toThrow("has no ## desk section")
		} finally {
			await rm(directory, { recursive: true, force: true })
		}
	})
})
