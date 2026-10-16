import { readdir, readFile, stat } from "node:fs/promises"
import { join } from "node:path"

import { repoSlug } from "../github/gh.ts"
import { describeIssue } from "../project/section.ts"
import { type Facts, PROJECT_FILE } from "./facts.ts"
import { SERENA_FIX } from "./tool-checks.ts"
import { type CheckResult, fail, type PreflightEnvironment, pass } from "./types.ts"

const LABEL_SCRIPT = join(".github", "scripts", "setup-labels.sh")
const LABEL_LIMIT = 5

export const SECTION_TEMPLATE_FIX =
	"add a ## desk section to CLAUDE.md from ~/.claude/kit/modules/desk/desk-section.md"

export async function checkRulesLinked(environment: PreflightEnvironment): Promise<CheckResult[]> {
	const directory = join(environment.projectRoot, ".claude", "rules")
	const fix = "mise run rules:link"

	let names: string[]
	try {
		names = (await readdir(directory)).filter((name) => name.endsWith(".md"))
	} catch {
		return [fail("rules linked", "the project has no .claude/rules directory", fix)]
	}

	const dangling: string[] = []
	for (const name of names) {
		const resolves = await stat(join(directory, name)).then(
			() => true,
			() => false,
		)
		if (!resolves) dangling.push(name)
	}

	if (dangling.length === 0) return [pass("rules linked", `${names.length} rules linked`)]

	return [fail("rules linked", `rules that do not resolve: ${dangling.join(", ")}`, fix)]
}

export async function checkDeskSection(
	_: PreflightEnvironment,
	facts: Facts,
): Promise<CheckResult[]> {
	const result = await facts.section()

	if (result.kind === "ok") return [pass("## desk section", "## desk section parses")]

	if (result.kind === "missing") {
		return [fail("## desk section", `${PROJECT_FILE} has no ## desk section`, SECTION_TEMPLATE_FIX)]
	}

	const lines = result.issues.map((issue) => describeIssue(PROJECT_FILE, issue))

	return [
		fail(
			"## desk section",
			`## desk section is invalid: ${lines.join("; ")}`,
			`fix ${lines[0] ?? PROJECT_FILE}`,
		),
	]
}

export function parseLabelNames(script: string): string[] {
	const names: string[] = []
	let loop: { variable: string; values: string[] } | undefined

	for (const line of script.split("\n")) {
		const loopMatch = /^\s*for\s+(\w+)\s+in\s+(.+?);\s*do\s*$/.exec(line)
		if (loopMatch?.[1] !== undefined && loopMatch[2] !== undefined) {
			loop = { variable: loopMatch[1], values: loopMatch[2].split(/\s+/) }
			continue
		}

		if (/^\s*done\s*$/.test(line)) {
			loop = undefined
			continue
		}

		const created = /^\s*create_label\s+"?([^"\s]+)"?/.exec(line)?.[1]
		if (created === undefined || created === "$1") continue

		if (loop && created.includes(`\${${loop.variable}}`)) {
			const { variable, values } = loop
			names.push(...values.map((value) => created.replaceAll(`\${${variable}}`, value)))
		} else names.push(created)
	}

	return names
}

export async function checkLabels(environment: PreflightEnvironment): Promise<CheckResult[]> {
	const script = join(environment.projectRoot, LABEL_SCRIPT)
	const fix = `bash ${LABEL_SCRIPT}`

	let wanted: string[]
	try {
		wanted = parseLabelNames(await readFile(script, "utf8"))
	} catch {
		return [
			fail(
				"labels",
				`${LABEL_SCRIPT} is missing`,
				"copy .github/scripts/setup-labels.sh from modules/issues/scaffold in the kit",
			),
		]
	}

	const listed = await environment.run("gh", [
		"label",
		"list",
		"--repo",
		repoSlug(environment.repo),
		"--limit",
		"200",
		"--json",
		"name",
		"--jq",
		".[].name",
	])
	if (listed.status !== 0) {
		return [fail("labels", `gh label list failed: ${listed.stderr.trim()}`, fix)]
	}

	const present = new Set(listed.stdout.split("\n").map((name) => name.trim()))
	const missing = wanted.filter((name) => !present.has(name))
	if (missing.length === 0) return [pass("labels", `${wanted.length} labels exist`)]

	const shown = missing.slice(0, LABEL_LIMIT).join(", ")
	const more = missing.length > LABEL_LIMIT ? ` and ${missing.length - LABEL_LIMIT} more` : ""

	return [fail("labels", `labels missing: ${shown}${more}`, fix)]
}

export async function checkProjectNeeds(
	environment: PreflightEnvironment,
	facts: Facts,
): Promise<CheckResult[]> {
	const result = await facts.section()
	if (result.kind !== "ok") return []

	const checks: CheckResult[] = []
	for (const need of result.section.preflight.needs) {
		const check = `project need ${need.command}`
		const ran = await environment.run("sh", ["-c", need.command], { cwd: environment.projectRoot })

		checks.push(
			ran.status === 0
				? pass(check, `${need.command} passes`)
				: fail(check, `${need.command} exited ${ran.status}`, need.fix),
		)
	}

	return checks
}

export async function checkMcpServers(
	environment: PreflightEnvironment,
	facts: Facts,
): Promise<CheckResult[]> {
	const result = await facts.section()
	if (result.kind !== "ok") return []

	const alreadyChecked = environment.role === "worker" ? ["serena"] : []
	const names = result.section.preflight.mcp.filter((name) => !alreadyChecked.includes(name))
	if (names.length === 0) return []

	const servers = await facts.mcpServers()

	return names.map((name) => {
		const check = `mcp ${name}`
		if (servers.kind === "listed" && servers.connected.has(name))
			return pass(check, `${name} connected`)

		return fail(
			check,
			`${name} not connected`,
			name === "serena" ? SERENA_FIX : `claude mcp list and connect ${name}`,
		)
	})
}
