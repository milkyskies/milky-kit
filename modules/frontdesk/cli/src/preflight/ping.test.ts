import { describe, expect, test } from "bun:test"
import { existsSync } from "node:fs"

import { frontdeskMainPath } from "./ping.ts"

describe("frontdeskMainPath", () => {
	test("points at a file that exists on every platform, including Windows drive paths", () => {
		expect(existsSync(frontdeskMainPath())).toBe(true)
	})
})
