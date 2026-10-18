import { describe, expect, test } from "bun:test"

import { spawnShell } from "./shell.ts"

describe("spawnShell", () => {
	test("a timeout kills the whole process group, so a pipeline holding the output open cannot stall it", async () => {
		const started = Date.now()

		const result = await spawnShell(["sh", "-c", "sleep 5 | cat"], undefined, { timeoutMs: 200 })

		expect(Date.now() - started).toBeLessThan(1000)
		expect(result.timedOut).toBe(true)
	})

	test("a command that finishes in time reports its output and no timeout", async () => {
		const result = await spawnShell(["sh", "-c", "echo done"], undefined, { timeoutMs: 5000 })

		expect(result).toMatchObject({ code: 0, stdout: "done\n", timedOut: false })
	})
})
