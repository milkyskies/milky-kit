import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { FAKE_REPO } from "../../github/testing/fake-gh.ts"
import type { PreflightEnvironment, Role, Runner, RunResult } from "../types.ts"

export const START_PID = 5000
export const CLAUDE_PID = 4000

export const DESK_SECTION = `## desk

### Coordinator
- machine: Minerva
- ask: ask:choices
- check: mise run check

### Machines
- Minerva: workers 3
- zeus: workers 2, repo \`~/Code/Projects/kansai-2\`

### Preflight
- \`pg_isready -h localhost -p 5432\` - fix: \`docker compose up -d db\`
- mcp: serena, blender
`

const LABEL_SCRIPT = `#!/usr/bin/env bash
create_label() {
  gh label create "$1" --color "$2" --description "$3" --force
}

create_label request "1d76db" "Work to be built"
create_label stage:ready "0e8a16" "Ready"

for points in 1 2 3; do
  create_label "points:\${points}" "ededed" "Effort estimate: \${points}"
done
`

export const OK: RunResult = { status: 0, stdout: "", stderr: "" }

export function ok(stdout: string): RunResult {
	return { status: 0, stdout, stderr: "" }
}

export function failed(stderr = "boom", status = 1): RunResult {
	return { status, stdout: "", stderr }
}

export type World = {
	home: string
	projectRoot: string
	script: Map<string, RunResult>
	calls: string[]
	liveProcesses: Set<number>
	environment: (role: Role) => PreflightEnvironment
	run: Runner
	cleanup: () => Promise<void>
}

export function orcaStatusJson(sessionId: string | undefined, reachable = true): string {
	return JSON.stringify({
		ok: true,
		result: {
			runtime: { reachable },
			...(sessionId ? { caller: { orcaSessionId: sessionId } } : {}),
		},
	})
}

export function hostListJson(machineName: string): string {
	return JSON.stringify({
		ok: true,
		result: {
			hosts: [
				{ kind: "local", name: "this machine", machineName },
				{ kind: "environment", name: "zeus" },
			],
		},
	})
}

export const MCP_LIST = `Checking MCP server health…

serena: serena start-mcp-server --context=claude-code --project-from-cwd - ✔ Connected
blender: uvx blender-mcp - ✔ Connected
claude.ai Claude Docs: https://api.anthropic.com/v1/pages/mcp - ✔ Connected
`

export async function makeWorld(options: { section?: string } = {}): Promise<World> {
	const root = await mkdtemp(join(tmpdir(), "desk-world-"))
	const home = join(root, "home")
	const projectRoot = join(root, "project")
	const kit = join(home, ".claude", "kit")

	await mkdir(join(kit, "modules", "desk", "bin"), { recursive: true })
	await mkdir(join(kit, "modules", "desk", "rules"), { recursive: true })
	await writeFile(join(kit, "modules", "desk", "bin", "desk"), "#!/bin/sh\n")
	await chmod(join(kit, "modules", "desk", "bin", "desk"), 0o755)
	await writeFile(join(kit, "modules", "desk", "rules", "desk.md"), "# desk\n")

	await mkdir(join(projectRoot, ".claude", "rules"), { recursive: true })
	await symlink(
		join(kit, "modules", "desk", "rules", "desk.md"),
		join(projectRoot, ".claude", "rules", "desk.md"),
	)
	await mkdir(join(projectRoot, ".github", "scripts"), { recursive: true })
	await writeFile(join(projectRoot, ".github", "scripts", "setup-labels.sh"), LABEL_SCRIPT)
	await writeFile(join(projectRoot, "CLAUDE.md"), `# project\n\n${options.section ?? DESK_SECTION}`)

	const script = new Map<string, RunResult>([
		["bun --version", ok("1.3.0\n")],
		[`git -C ${kit} fetch -q`, OK],
		[`git -C ${kit} rev-list --count HEAD..origin/main`, ok("0\n")],
		["orca status --json", ok(orcaStatusJson("sess-me"))],
		["orca status --environment zeus --json", ok(orcaStatusJson(undefined))],
		["orca host list --json", ok(hostListJson("Minerva"))],
		["gh auth status", OK],
		[`gh repo view ${FAKE_REPO} --json viewerPermission --jq .viewerPermission`, ok("ADMIN\n")],
		[
			`gh label list --repo ${FAKE_REPO} --limit 200 --json name --jq .[].name`,
			ok("request\nstage:ready\npoints:1\npoints:2\npoints:3\n"),
		],
		["mise ls --missing", OK],
		["claude mcp list", ok(MCP_LIST)],
		["sh -c pg_isready -h localhost -p 5432", OK],
		["hostname -s", ok("minerva\n")],
		[`ps -o ppid=,comm= -p ${START_PID}`, ok(`${CLAUDE_PID} bun\n`)],
		[`ps -o ppid=,comm= -p ${CLAUDE_PID}`, ok("3000 claude\n")],
	])

	const calls: string[] = []
	const run: Runner = async (command, args) => {
		const key = [command, ...args].join(" ")
		calls.push(key)

		const result = script.get(key)
		if (!result) throw new Error(`unscripted command: ${key}`)

		return result
	}

	const liveProcesses = new Set<number>()
	const [owner = "", name = ""] = FAKE_REPO.split("/")

	return {
		home,
		projectRoot,
		script,
		calls,
		liveProcesses,
		run,
		environment: (role) => ({
			role,
			run,
			repo: { owner, name },
			home,
			projectRoot,
			variables: { DESK_NTFY_URL: "http://zeus:8090", DESK_NTFY_TOPIC: "abc123" },
			startPid: START_PID,
			isAlive: (pid) => liveProcesses.has(pid),
			now: () => new Date("2026-10-16T14:00:00Z"),
		}),
		cleanup: () => rm(root, { recursive: true, force: true }),
	}
}
