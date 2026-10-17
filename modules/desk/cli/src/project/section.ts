import { readFile } from "node:fs/promises"

export const ASK_SETTINGS = ["ask:everything", "ask:choices", "ask:own-feel"]
export const DEFAULT_CHECK_COMMAND = "mise run check"
export const DEFAULT_WORKER_LIMIT = 3
export const DEFAULT_LANDING = "land:check"
export const LANDINGS = ["land:check", "land:auto"] as const

export type Landing = (typeof LANDINGS)[number]

export type Machine = { name: string; workers: number; repo: string | undefined }

export type PreflightNeed = { command: string; fix: string }

export type DeskSection = {
	coordinator: { machine: string; ask: string; check: string; land: Landing }
	machines: Machine[]
	reviewPaths: string[]
	preflight: { needs: PreflightNeed[]; mcp: string[] }
}

export type SectionIssue = { line: number; message: string }

export type SectionResult =
	| { kind: "missing" }
	| { kind: "invalid"; issues: SectionIssue[] }
	| { kind: "ok"; section: DeskSection }

type Line = { number: number; text: string }

type Subsection = { title: string; line: number; lines: Line[] }

const FENCE = /^\s*(```|~~~)/
const SECTION_HEADING = /^## desk\s*$/
const OTHER_SECTION_HEADING = /^## /
const SUBSECTION_HEADING = /^### (.+?)\s*$/
const KEY_VALUE_BULLET = /^-\s+([^:]+?):\s*(.*?)\s*$/
const COMMAND_BULLET = /^-\s+`([^`]+)`(?:\s+-\s+fix:\s+`([^`]+)`)?\s*$/
const WORKER_ITEM = /^workers\s+(\d+)$/
const GLOB_BULLET = /^-\s+`([^`]+)`(?:\s+-\s+.*)?$/
const REPO_ITEM = /^repo\s+`([^`]+)`$/

function splitSubsections(
	markdown: string,
): { heading: number; subsections: Subsection[] } | undefined {
	const subsections: Subsection[] = []
	let heading: number | undefined
	let fenced = false

	for (const [index, text] of markdown.split("\n").entries()) {
		const number = index + 1

		if (FENCE.test(text)) fenced = !fenced

		if (!fenced && heading !== undefined && OTHER_SECTION_HEADING.test(text)) break

		if (!fenced && heading === undefined) {
			if (SECTION_HEADING.test(text)) heading = number

			continue
		}

		if (heading === undefined) continue

		const title = fenced ? undefined : SUBSECTION_HEADING.exec(text)?.[1]
		if (title !== undefined) {
			subsections.push({ title, line: number, lines: [] })
			continue
		}

		subsections.at(-1)?.lines.push({ number, text })
	}

	return heading === undefined ? undefined : { heading, subsections }
}

function contentLines(subsection: Subsection): Line[] {
	let fenced = false
	const kept: Line[] = []

	for (const line of subsection.lines) {
		if (FENCE.test(line.text)) {
			fenced = !fenced
			continue
		}

		const text = line.text.trim()
		if (fenced || text === "" || text.startsWith("<!--")) continue

		kept.push({ number: line.number, text })
	}

	return kept
}

function parseCoordinator(
	subsection: Subsection | undefined,
	heading: number,
	issues: SectionIssue[],
): DeskSection["coordinator"] {
	const values = new Map<string, string>()

	if (subsection === undefined) {
		issues.push({ line: heading, message: "the section has no ### Coordinator" })
	}

	for (const line of subsection ? contentLines(subsection) : []) {
		const match = KEY_VALUE_BULLET.exec(line.text)
		const key = match?.[1]
		const value = match?.[2]
		if (key === undefined || value === undefined) {
			issues.push({
				line: line.number,
				message: `expected "- key: value" in ### Coordinator, got "${line.text}"`,
			})
			continue
		}

		if (key !== "machine" && key !== "ask" && key !== "check" && key !== "land") {
			issues.push({ line: line.number, message: `unknown key "${key}" in ### Coordinator` })
			continue
		}

		values.set(key, value)
	}

	const machine = values.get("machine") ?? ""
	const ask = values.get("ask") ?? ""

	if (subsection !== undefined && machine === "") {
		issues.push({ line: subsection.line, message: "### Coordinator needs a machine" })
	}

	if (subsection !== undefined && !ASK_SETTINGS.includes(ask)) {
		issues.push({
			line: subsection.line,
			message: `### Coordinator needs ask set to one of ${ASK_SETTINGS.join(", ")}`,
		})
	}

	const configuredLand = values.get("land")
	const land = LANDINGS.find((landing) => landing === configuredLand)
	if (subsection !== undefined && configuredLand !== undefined && land === undefined) {
		issues.push({
			line: subsection.line,
			message: `### Coordinator land must be one of ${LANDINGS.join(", ")}, got "${configuredLand}"`,
		})
	}

	return {
		machine,
		ask,
		check: values.get("check") || DEFAULT_CHECK_COMMAND,
		land: land ?? DEFAULT_LANDING,
	}
}

function parseReviewPaths(subsection: Subsection | undefined, issues: SectionIssue[]): string[] {
	const globs: string[] = []

	for (const line of subsection ? contentLines(subsection) : []) {
		const glob = GLOB_BULLET.exec(line.text)?.[1]
		if (glob === undefined) {
			issues.push({
				line: line.number,
				message: `expected "- \`glob\`" in ### Review paths, got "${line.text}"`,
			})
			continue
		}

		globs.push(glob)
	}

	return globs
}

export function landingOf(labels: readonly string[], section: DeskSection): Landing {
	const requested = LANDINGS.filter((landing) => labels.includes(landing))

	if (requested.length > 1) return "land:check"

	return requested[0] ?? section.coordinator.land
}

function parseMachines(subsection: Subsection | undefined, issues: SectionIssue[]): Machine[] {
	const machines: Machine[] = []

	for (const line of subsection ? contentLines(subsection) : []) {
		const match = KEY_VALUE_BULLET.exec(line.text)
		const name = match?.[1]
		const rest = match?.[2]
		if (name === undefined || rest === undefined) {
			issues.push({
				line: line.number,
				message: `expected "- <machine>: workers N" in ### Machines, got "${line.text}"`,
			})
			continue
		}

		let workers: number | undefined
		let repo: string | undefined

		for (const item of rest.split(",").map((part) => part.trim())) {
			const workerMatch = WORKER_ITEM.exec(item)
			const repoMatch = REPO_ITEM.exec(item)

			if (workerMatch?.[1] !== undefined) workers = Number(workerMatch[1])
			else if (repoMatch?.[1] !== undefined) repo = repoMatch[1]
			else if (!/^(workers|repo)\b/.test(item)) {
				issues.push({
					line: line.number,
					message: `unknown key "${item.split(/\s/)[0]}" in ### Machines line for ${name}`,
				})
			} else if (item.startsWith("repo")) {
				issues.push({
					line: line.number,
					message: `### Machines line for ${name} needs repo \`selector\` in backticks`,
				})
			}
		}

		if (workers === undefined || workers < 1) {
			issues.push({
				line: line.number,
				message: `### Machines line for ${name} needs "workers N" with N at least 1`,
			})
			continue
		}

		machines.push({ name, workers, repo })
	}

	return machines
}

function parsePreflight(
	subsection: Subsection | undefined,
	issues: SectionIssue[],
): DeskSection["preflight"] {
	const needs: PreflightNeed[] = []
	const mcp: string[] = []

	for (const line of subsection ? contentLines(subsection) : []) {
		const keyed = KEY_VALUE_BULLET.exec(line.text)
		if (keyed?.[1] === "mcp") {
			mcp.push(
				...(keyed[2] ?? "")
					.split(",")
					.map((name) => name.trim())
					.filter((name) => name !== ""),
			)
			continue
		}

		const command = COMMAND_BULLET.exec(line.text)
		const text = command?.[1]
		const fix = command?.[2]
		if (text === undefined) {
			issues.push({
				line: line.number,
				message: `unknown key in ### Preflight, expected "- mcp: a, b" or "- \`command\` - fix: \`fix\`", got "${line.text}"`,
			})
			continue
		}

		if (fix === undefined) {
			issues.push({
				line: line.number,
				message: `### Preflight command \`${text}\` needs "- fix: \`command\`" beside it`,
			})
			continue
		}

		needs.push({ command: text, fix })
	}

	return { needs, mcp }
}

export function parseDeskSection(markdown: string): SectionResult {
	const split = splitSubsections(markdown)
	if (split === undefined) return { kind: "missing" }

	const find = (title: string) => split.subsections.find((subsection) => subsection.title === title)
	const issues: SectionIssue[] = []

	const coordinator = parseCoordinator(find("Coordinator"), split.heading, issues)
	const machines = parseMachines(find("Machines"), issues)
	const preflight = parsePreflight(find("Preflight"), issues)
	const reviewPaths = parseReviewPaths(find("Review paths"), issues)

	if (issues.length > 0) return { kind: "invalid", issues: issues.sort((a, b) => a.line - b.line) }

	return { kind: "ok", section: { coordinator, machines, preflight, reviewPaths } }
}

export function describeIssue(file: string, issue: SectionIssue): string {
	return `${file} line ${issue.line}: ${issue.message}`
}

export function workerMachines(section: DeskSection): Machine[] {
	if (section.machines.length > 0) return section.machines

	return [{ name: section.coordinator.machine, workers: DEFAULT_WORKER_LIMIT, repo: undefined }]
}

export function remoteMachines(section: DeskSection): Machine[] {
	return section.machines.filter((machine) => machine.name !== section.coordinator.machine)
}

export async function readDeskSection(claudeMdPath: string): Promise<DeskSection> {
	const result = parseDeskSection(await readFile(claudeMdPath, "utf8"))

	if (result.kind === "ok") return result.section
	if (result.kind === "missing") throw new Error(`${claudeMdPath} has no ## desk section`)

	const lines = result.issues.map((issue) => describeIssue(claudeMdPath, issue))

	throw new Error(`## desk section is invalid: ${lines.join("; ")}`)
}
