import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { loadUserEnvironment, ntfySettings, parseEnvFile } from "./env.ts"

describe("user environment", () => {
	let home: string

	beforeEach(async () => {
		home = await mkdtemp(join(tmpdir(), "desk-env-"))
	})

	afterEach(async () => {
		await rm(home, { recursive: true, force: true })
	})

	async function writeEnvFile(text: string): Promise<void> {
		await mkdir(join(home, ".config", "desk"), { recursive: true })
		await writeFile(join(home, ".config", "desk", ".env"), text)
	}

	test("parses comments, quotes and empty values", () => {
		const parsed = parseEnvFile(
			'# server\nDESK_NTFY_URL="http://zeus:8090"\nDESK_NTFY_TOPIC=abc\nDESK_NTFY_TOKEN=\nbroken line\n',
		)

		expect(parsed).toEqual({ DESK_NTFY_URL: "http://zeus:8090", DESK_NTFY_TOPIC: "abc" })
	})

	test("reads ~/.config/desk/.env, and the process environment wins over the file", async () => {
		await writeEnvFile("DESK_NTFY_URL=http://file\nDESK_NTFY_TOPIC=from-file\n")

		const environment = await loadUserEnvironment(home, { DESK_NTFY_TOPIC: "from-process" })

		expect(environment.DESK_NTFY_URL).toBe("http://file")
		expect(environment.DESK_NTFY_TOPIC).toBe("from-process")
	})

	test("a missing file is an empty file, never an error", async () => {
		expect(await loadUserEnvironment(home, {})).toEqual({})
	})

	test("ntfy settings need a server and a topic, and drop a trailing slash and an empty token", () => {
		expect(
			ntfySettings({
				DESK_NTFY_URL: "http://zeus:8090/",
				DESK_NTFY_TOPIC: "t",
				DESK_NTFY_TOKEN: "",
			}),
		).toEqual({
			url: "http://zeus:8090",
			topic: "t",
			token: undefined,
		})
		expect(ntfySettings({ DESK_NTFY_URL: "http://zeus:8090" })).toBeUndefined()
		expect(ntfySettings({ DESK_NTFY_TOPIC: "t" })).toBeUndefined()
	})
})
