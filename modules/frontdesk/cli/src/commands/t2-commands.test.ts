import { describe, expect, test } from "bun:test"

const COMMANDS = ["reconcile", "watch", "digest", "merge", "land", "run"]

describe("the T2 commands are reachable through main.ts", () => {
	test.each(COMMANDS)("%s exports run", async (name) => {
		const loaded: unknown = await import(`./${name}.ts`)

		expect(
			typeof loaded === "object" && loaded !== null && Reflect.get(loaded, "run"),
		).toBeInstanceOf(Function)
	})

	test("ping runs without a repository, so it works outside a checkout", async () => {
		const loaded: unknown = await import("./ping.ts")

		expect(
			typeof loaded === "object" && loaded !== null && Reflect.get(loaded, "runWithoutRepo"),
		).toBeInstanceOf(Function)
	})
})
