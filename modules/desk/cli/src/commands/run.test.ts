import { describe, expect, test } from "bun:test"

import { FakeOrca } from "../orca/testing/fake-orca.ts"
import { makeListingHarness } from "../reconcile/testing/github.ts"
import { runWith } from "./run.ts"

describe("desk run", () => {
	test("binds the existing Run whose objective is desk <owner>/<repo>", async () => {
		const { context, output } = makeListingHarness()
		const fakeOrca = new FakeOrca()
		fakeOrca.runs = [
			{ id: "run_other", objective: "desk milkyskies/other" },
			{ id: "run_kit", objective: "desk milkyskies/kit" },
		]

		await runWith({ orca: fakeOrca.orca }, context)

		expect(output).toEqual(["run_kit"])
		expect(fakeOrca.called("run-use", "run_kit")).toHaveLength(1)
		expect(fakeOrca.called("run-create")).toHaveLength(0)
	})

	test("creates the Run when none exists, and a fresh coordinator then finds the same one", async () => {
		const { context, output } = makeListingHarness()
		const fakeOrca = new FakeOrca()
		fakeOrca.runs = []

		await runWith({ orca: fakeOrca.orca }, context)
		await runWith({ orca: fakeOrca.orca }, context)

		expect(fakeOrca.called("run-create", "desk milkyskies/kit")).toHaveLength(1)
		expect(output).toEqual(["run_new", "run_new"])
	})
})
