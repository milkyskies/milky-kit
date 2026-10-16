export type ShellResult = { code: number; stdout: string; stderr: string }

export type Shell = (command: readonly string[], cwd?: string) => Promise<ShellResult>

export const spawnShell: Shell = async (command, cwd) => {
	const child = Bun.spawn([...command], { cwd, stdin: "ignore", stdout: "pipe", stderr: "pipe" })
	const [stdout, stderr, code] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	])

	return { code, stdout, stderr }
}

const FAILURE_LINE = /\b(fail|failed|failing|error|errors)\b/i

export function firstFailingLine(result: ShellResult): string {
	const lines = `${result.stdout}\n${result.stderr}`
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line !== "")

	return lines.find((line) => FAILURE_LINE.test(line)) ?? lines.at(-1) ?? `exit ${result.code}`
}
