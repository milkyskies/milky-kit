import { type Gh, type Repo, repoSlug } from "../github/gh.ts"
import { parseJson, readArray, readField, readNumber, readString } from "../json.ts"

export type CiStatus =
	| { kind: "none" }
	| { kind: "blocked"; detail: string }
	| { kind: "failing"; names: string[] }
	| { kind: "pending" }
	| { kind: "passed" }

const BLOCKED_MESSAGE =
	/account is locked due to a billing issue/
const FAILED_CONCLUSIONS = [
	"failure",
	"timed_out",
	"cancelled",
	"startup_failure",
	"action_required",
]

async function annotationsBlocked(gh: Gh, repo: Repo, runId: number): Promise<boolean> {
	const raw = await gh(["api", `repos/${repoSlug(repo)}/check-runs/${runId}/annotations`])
	const annotations = parseJson(raw)
	if (!Array.isArray(annotations)) return false

	return annotations.some((annotation) => {
		const message = readField(annotation, "message")

		return typeof message === "string" && BLOCKED_MESSAGE.test(message)
	})
}

export async function ciStatus(
	gh: Gh,
	repo: Repo,
	sha: string,
	hasWorkflows: boolean,
): Promise<CiStatus> {
	if (!hasWorkflows) return { kind: "none" }

	const permissions = parseJson(await gh(["api", `repos/${repoSlug(repo)}/actions/permissions`]))
	if (readField(permissions, "enabled") === false) {
		return { kind: "blocked", detail: "GitHub Actions is disabled for this repository" }
	}

	const runs = readArray(
		parseJson(await gh(["api", `repos/${repoSlug(repo)}/commits/${sha}/check-runs`])),
		"check_runs",
	)
	const failed = runs.filter((run) => {
		const conclusion = readField(run, "conclusion")

		return typeof conclusion === "string" && FAILED_CONCLUSIONS.includes(conclusion)
	})

	if (failed.length > 0) {
		for (const run of failed) {
			if (await annotationsBlocked(gh, repo, readNumber(run, "id"))) {
				return {
					kind: "blocked",
					detail: `${readString(run, "name")} was not started: billing or account lock`,
				}
			}
		}

		return { kind: "failing", names: failed.map((run) => readString(run, "name")) }
	}

	const unfinished = runs.some((run) => readField(run, "status") !== "completed")

	return runs.length === 0 || unfinished ? { kind: "pending" } : { kind: "passed" }
}
