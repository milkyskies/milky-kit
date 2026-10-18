import { describe, expect, test } from "bun:test"

import { machineReachability } from "./hosts.ts"
import { FakeOrca } from "./testing/fake-orca.ts"

describe("machine reachability", () => {
	test("the remote machine is reachable when the local Orca says so", async () => {
		expect(await machineReachability(new FakeOrca().orca, "zeus")).toBe("reachable")
	})

	test("the remote machine is unreachable only when the local Orca answers and reports it so", async () => {
		const fakeOrca = new FakeOrca()
		fakeOrca.reachable.set("zeus", false)

		expect(await machineReachability(fakeOrca.orca, "zeus")).toBe("unreachable")
	})

	test("a local Orca that errors says nothing about the remote machine", async () => {
		const fakeOrca = new FakeOrca()
		fakeOrca.failing.add("status")

		expect(await machineReachability(fakeOrca.orca, "zeus")).toBe("unknown")
	})

	test("a local Orca that reports itself unreachable says nothing about the remote machine", async () => {
		const fakeOrca = new FakeOrca()
		fakeOrca.reachable.set("local", false)

		expect(await machineReachability(fakeOrca.orca, "zeus")).toBe("unknown")
	})
})
