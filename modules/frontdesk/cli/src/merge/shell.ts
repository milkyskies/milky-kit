export type ShellResult = { code: number; stdout: string; stderr: string; timedOut?: boolean }

export type ShellOptions = { timeoutMs?: number }

export type Shell = (
	command: readonly string[],
	cwd?: string,
	options?: ShellOptions,
) => Promise<ShellResult>

export const spawnShell: Shell = async (command, cwd, options) => {
	// The command leads its own process group so a timeout can kill the pipelines and grandchildren that hold the output pipes open.
	const child = Bun.spawn([...command], {
		cwd,
		stdin: "ignore",
		stdout: "pipe",
		stderr: "pipe",
		detached: true,
	})
	let timedOut = false
	const timer =
		options?.timeoutMs === undefined
			? undefined
			: setTimeout(() => {
					timedOut = true
					try {
						process.kill(-child.pid, "SIGKILL")
					} catch {
						child.kill("SIGKILL")
					}
				}, options.timeoutMs)

	try {
		const [stdout, stderr, code] = await Promise.all([
			new Response(child.stdout).text(),
			new Response(child.stderr).text(),
			child.exited,
		])

		return { code, stdout, stderr, timedOut }
	} finally {
		clearTimeout(timer)
	}
}

const FAILURE_LINE = /\b(fail|failed|failing|error|errors)\b/i

export function firstFailingLine(result: ShellResult): string {
	const lines = `${result.stdout}\n${result.stderr}`
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line !== "")

	return lines.find((line) => FAILURE_LINE.test(line)) ?? lines.at(-1) ?? `exit ${result.code}`
}
