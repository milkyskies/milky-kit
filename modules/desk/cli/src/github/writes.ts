import { parseJson, readNumber } from "../json.ts"
import type { Claim } from "./derive.ts"
import type { Gh, Repo } from "./gh.ts"
import { repoSlug } from "./gh.ts"
import { composeComment } from "./markers.ts"

export async function postComment(
	gh: Gh,
	repo: Repo,
	issue: number,
	body: string,
): Promise<number> {
	const raw = await gh(
		["api", "-X", "POST", `repos/${repoSlug(repo)}/issues/${issue}/comments`, "--input", "-"],
		JSON.stringify({ body }),
	)

	return readNumber(parseJson(raw), "id")
}

export type LabelChange = {
	add?: string[]
	remove?: string[]
	assignSelf?: boolean
}

export async function editLabels(
	gh: Gh,
	repo: Repo,
	issue: number,
	change: LabelChange,
): Promise<void> {
	const args = ["issue", "edit", String(issue), "--repo", repoSlug(repo)]
	if (change.add?.length) args.push("--add-label", change.add.join(","))
	if (change.remove?.length) args.push("--remove-label", change.remove.join(","))
	if (change.assignSelf) args.push("--add-assignee", "@me")

	await gh(args)
}

export async function moveStage(
	gh: Gh,
	repo: Repo,
	issue: number,
	from: string,
	to: string,
	assignSelf = false,
): Promise<void> {
	await editLabels(gh, repo, issue, { add: [to], remove: [from], assignSelf })
}

export async function closeNotPlanned(gh: Gh, repo: Repo, issue: number): Promise<void> {
	await gh(["issue", "close", String(issue), "--repo", repoSlug(repo), "--reason", "not planned"])
}

export async function editBody(gh: Gh, repo: Repo, issue: number, body: string): Promise<void> {
	await gh(["issue", "edit", String(issue), "--repo", repoSlug(repo), "--body-file", "-"], body)
}

export async function releaseClaims(
	gh: Gh,
	repo: Repo,
	issue: number,
	claims: readonly Claim[],
	reason: string,
): Promise<void> {
	for (const claim of claims) {
		await postComment(
			gh,
			repo,
			issue,
			composeComment(
				"release",
				{ claim: claim.id, reason },
				`Released claim ${claim.id}: ${reason}.`,
			),
		)
	}
}
