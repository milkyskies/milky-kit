import { describe, expect, test } from "bun:test"
import { existsSync } from "node:fs"
import { join } from "node:path"

import manifest from "../package.json"

const root = join(import.meta.dir, "..")

describe("the installable package", () => {
	test("every exported parser path exists and imports", async () => {
		for (const [name, target] of Object.entries(manifest.exports)) {
			expect(existsSync(join(root, target)), `${name} -> ${target}`).toBe(true)
			expect(Object.keys(await import(join(root, target))).length).toBeGreaterThan(0)
		}
	})

	test("the bin is a Bun script that exists", async () => {
		const path = join(root, manifest.bin.frontdesk)

		expect(existsSync(path)).toBe(true)
		expect(await Bun.file(path).text()).toStartWith("#!/usr/bin/env bun\n")
	})

	test("the package is scoped and names the repository a git install clones", () => {
		expect(manifest.name).toStartWith("@milkyskies/")
		expect(manifest.repository.url).toBe("git+https://github.com/milkyskies/milky-kit.git")
		expect(manifest.repository.directory).toBe("modules/frontdesk/cli")
	})
})
