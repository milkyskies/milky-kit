import { readArray, readString } from "../json.ts"
import type { Orca } from "./runner.ts"

export type Task = { id: string; title: string; createdAt: Date | undefined }

const ISSUE_TITLE = /^#(\d+) /

export function issueNumberOfTitle(title: string): number | undefined {
	const match = ISSUE_TITLE.exec(title)

	return match?.[1] === undefined ? undefined : Number(match[1])
}

export async function listTasks(orca: Orca, run: string): Promise<Task[]> {
	const result = await orca(["orchestration", "task-list", "--run", run])

	return readArray(result, "tasks").map((row) => {
		const created = Date.parse(readString(row, "created_at"))

		return {
			id: readString(row, "id"),
			title: readString(row, "task_title"),
			createdAt: Number.isNaN(created) ? undefined : new Date(created),
		}
	})
}
