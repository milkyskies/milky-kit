import type { Shell, ShellResult } from "./shell.ts"

type Handler = ShellResult | ((command: readonly string[], cwd: string | undefined) => ShellResult)

export class FakeShell {
	readonly calls: { command: string[]; cwd: string | undefined }[] = []
	private readonly handlers: { prefix: string; handler: Handler }[] = []

	constructor() {
		this.on("git rev-parse --show-toplevel", ok("/repos/kit\n"))
		this.on("git rev-parse HEAD", ok("sha123\n"))
	}

	on(prefix: string, handler: Handler): void {
		this.handlers.unshift({ prefix, handler })
	}

	readonly shell: Shell = async (command, cwd) => {
		this.calls.push({ command: [...command], cwd })
		const line = command.join(" ")
		const match = this.handlers.find((candidate) => line.startsWith(candidate.prefix))
		if (!match) return ok("")

		return typeof match.handler === "function" ? match.handler(command, cwd) : match.handler
	}

	called(prefix: string): { command: string[]; cwd: string | undefined }[] {
		return this.calls.filter((call) => call.command.join(" ").startsWith(prefix))
	}
}

export function ok(stdout: string): ShellResult {
	return { code: 0, stdout, stderr: "" }
}

export function failed(stdout: string, code = 1): ShellResult {
	return { code, stdout, stderr: "" }
}
