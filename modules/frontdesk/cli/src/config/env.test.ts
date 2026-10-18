import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { loadUserEnvironment, ntfySettings, parseEnvFile } from "./env.ts"

describe("user environment", () => {
	let home: string

	beforeEach(async () => {
		home = await mkdtemp(join(tmpdir(), "frontdesk-env-"))
	})

	afterEach(async () => {
		await rm(home, { recursive: true, force: true })
	})

	async function writeEnvFile(text: string): Promise<void> {
		await mkdir(join(home, ".config", "frontdesk"), { recursive: true })
		await writeFile(join(home, ".config", "frontdesk", ".env"), text)
	}

	test("parses comments, quotes and empty values", () => {
		const parsed = parseEnvFile(
			'# server\nFRONTDESK_NTFY_URL="http://zeus:8090"\nFRONTDESK_NTFY_TOPIC=abc\nFRONTDESK_NTFY_TOKEN=\nbroken line\n',
		)

		expect(parsed).toEqual({ FRONTDESK_NTFY_URL: "http://zeus:8090", FRONTDESK_NTFY_TOPIC: "abc" })
	})

	test("reads ~/.config/frontdesk/.env, and the process environment wins over the file", async () => {
		await writeEnvFile("FRONTDESK_NTFY_URL=http://file\nFRONTDESK_NTFY_TOPIC=from-file\n")

		const environment = await loadUserEnvironment(home, { FRONTDESK_NTFY_TOPIC: "from-process" })

		expect(environment.FRONTDESK_NTFY_URL).toBe("http://file")
		expect(environment.FRONTDESK_NTFY_TOPIC).toBe("from-process")
	})

	test("a missing file is an empty file, never an error", async () => {
		expect(await loadUserEnvironment(home, {})).toEqual({})
	})

	test("ntfy settings need a server and a topic, and drop a trailing slash and an empty token", () => {
		expect(
			ntfySettings({
				FRONTDESK_NTFY_URL: "http://zeus:8090/",
				FRONTDESK_NTFY_TOPIC: "t",
				FRONTDESK_NTFY_TOKEN: "",
			}),
		).toEqual({
			url: "http://zeus:8090",
			topic: "t",
			token: undefined,
		})
		expect(ntfySettings({ FRONTDESK_NTFY_URL: "http://zeus:8090" })).toBeUndefined()
		expect(ntfySettings({ FRONTDESK_NTFY_TOPIC: "t" })).toBeUndefined()
	})
})
