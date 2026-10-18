import type { Runner } from "./types.ts"

export const NOT_FOUND = 127

export const spawnRunner: Runner = async (command, args, options) => {
	try {
		const child = Bun.spawn([command, ...args], {
			cwd: options?.cwd,
			stdin: "ignore",
			stdout: "pipe",
			stderr: "pipe",
		})

		const [stdout, stderr, status] = await Promise.all([
			new Response(child.stdout).text(),
			new Response(child.stderr).text(),
			child.exited,
		])

		return { status, stdout, stderr }
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error)

		return { status: NOT_FOUND, stdout: "", stderr: detail }
	}
}
