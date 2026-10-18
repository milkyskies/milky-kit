import { readArray, readString } from "../json.ts"
import type { Orca } from "./runner.ts"

export type Message = {
	id: string
	type: string
	from: string
	subject: string
	createdAt: Date
	dispatchId: string | undefined
}

const INBOX_LIMIT = "500"

function dispatchOfPayload(payload: unknown): string | undefined {
	if (typeof payload !== "string") return undefined

	try {
		const parsed: unknown = JSON.parse(payload)
		if (typeof parsed !== "object" || parsed === null || !("dispatchId" in parsed)) return undefined

		return typeof parsed.dispatchId === "string" ? parsed.dispatchId : undefined
	} catch {
		return undefined
	}
}

export async function readInbox(orca: Orca): Promise<Message[]> {
	const result = await orca(["orchestration", "inbox", "--limit", INBOX_LIMIT])

	return readArray(result, "messages").map((row) => ({
		id: readString(row, "id"),
		type: readString(row, "type"),
		from: readString(row, "from_handle"),
		subject: readString(row, "subject"),
		createdAt: new Date(readString(row, "created_at")),
		dispatchId: dispatchOfPayload(
			typeof row === "object" && row !== null && "payload" in row ? row.payload : undefined,
		),
	}))
}
