import type { ParsedComment } from "../github/derive.ts"
import { type Gh, type Repo, repoSlug } from "../github/gh.ts"
import { type IssueState, stageOf } from "../github/issue.ts"

export const RESURFACE_AFTER_MS = 48 * 60 * 60_000

const PINGED_LINE = /^<!-- desk:pinged at=(\S+) -->\s*$/m

export type DigestItem = {
	issue: number
	kind: "decision" | "result"
	comment: ParsedComment
	resurfaced: boolean
}

export type BadLabels = { issue: number; labels: string }

export type AutoMerged = { issue: number; comment: ParsedComment }

export type Digest = {
	items: DigestItem[]
	badLabels: BadLabels[]
	needsLook: BadLabels[]
	autoMerged: AutoMerged[]
}

export function pingedAt(body: string): Date | undefined {
	const match = PINGED_LINE.exec(body)
	if (match?.[1] === undefined) return undefined

	const time = Date.parse(match[1])

	return Number.isNaN(time) ? undefined : new Date(time)
}

function afterLastClaim(issue: IssueState): ParsedComment[] {
	const claimIndex = issue.comments.findLastIndex((comment) => comment.marker?.kind === "claim")

	return issue.comments.slice(claimIndex + 1)
}

function collectFor(issue: IssueState, now: Date): DigestItem[] {
	const stage = stageOf(issue)
	if (stage.kind !== "one") return []

	const wanted =
		stage.label === "stage:needs-you"
			? "decision"
			: stage.label === "stage:check"
				? "result"
				: undefined
	if (wanted === undefined) return []

	const candidates = afterLastClaim(issue).filter((comment) => comment.marker?.kind === wanted)
	const chosen = wanted === "result" ? candidates.slice(-1) : candidates
	const items: DigestItem[] = []

	for (const comment of chosen) {
		const pinged = pingedAt(comment.body)
		if (pinged === undefined) {
			items.push({ issue: issue.number, kind: wanted, comment, resurfaced: false })
		} else if (wanted === "decision" && now.getTime() - pinged.getTime() >= RESURFACE_AFTER_MS) {
			items.push({ issue: issue.number, kind: wanted, comment, resurfaced: true })
		}
	}

	return items
}

export function collectDigest(issues: readonly IssueState[], now: Date): Digest {
	const items = issues.filter((issue) => issue.open).flatMap((issue) => collectFor(issue, now))
	const badLabels = issues
		.filter((issue) => issue.open && stageOf(issue).kind === "ambiguous")
		.map((issue) => ({ issue: issue.number, labels: stageLabelsKey(issue) }))

	const autoMerged = issues.flatMap((issue) =>
		issue.comments
			.filter(
				(comment) =>
					comment.marker?.kind === "merge" &&
					comment.marker.attrs.by === "auto" &&
					pingedAt(comment.body) === undefined,
			)
			.map((comment) => ({ issue: issue.number, comment })),
	)
	autoMerged.sort((left, right) => left.issue - right.issue)

	return { items, badLabels, needsLook: [], autoMerged }
}

function stageLabelsKey(issue: IssueState): string {
	const stage = stageOf(issue)

	return stage.kind === "ambiguous" ? stage.labels.toSorted().join(",") || "none" : stage.label
}

function plural(count: number, one: string, many: string): string {
	return `${count} ${count === 1 ? one : many}`
}

export function digestMessage(repo: Repo, digest: Digest, appUrl?: string): string {
	const decisions = digest.items.filter((item) => item.kind === "decision").length
	const results = digest.items.filter((item) => item.kind === "result").length
	const parts: string[] = []

	if (decisions > 0) parts.push(plural(decisions, "decision waiting", "decisions waiting"))
	if (results > 0) parts.push(`${results} done to check`)
	if (digest.badLabels.length > 0) {
		parts.push(plural(digest.badLabels.length, "issue with bad labels", "issues with bad labels"))
	}

	if (digest.needsLook.length > 0) {
		parts.push(plural(digest.needsLook.length, "request needs a look", "requests need a look"))
	}

	if (digest.autoMerged.length > 0) {
		parts.push(plural(digest.autoMerged.length, "merged by an agent", "merged by agents"))
	}

	const labels = [
		...(decisions > 0 ? ["stage:needs-you"] : []),
		...(results > 0 ? ["stage:check"] : []),
	]
	const query = labels.length > 0 ? `is:open+label:${labels.join(",")}` : "is:open"
	const base = `https://github.com/${repoSlug(repo)}/issues`
	const showQueryLink = labels.length > 0 || digest.autoMerged.length === 0
	const homeLink = appUrl ? appUrl.replace(/\/+$/, "") : `${base}?q=${query}`
	const links = [
		...(showQueryLink ? [homeLink] : []),
		...digest.autoMerged.map((merged) => `${base}/${merged.issue}`),
	]

	return `${repo.name}: ${parts.join(", ")}\n${links.join("\n")}`
}

export function markedBody(body: string, now: Date): string {
	const stripped = body.replace(PINGED_LINE, "").trimEnd()

	return `${stripped}\n<!-- desk:pinged at=${now.toISOString().slice(0, 19)}Z -->\n`
}

export async function markPinged(
	gh: Gh,
	repo: Repo,
	comment: ParsedComment,
	now: Date,
): Promise<void> {
	await gh(
		[
			"api",
			"-X",
			"PATCH",
			`repos/${repoSlug(repo)}/issues/comments/${comment.databaseId}`,
			"--input",
			"-",
		],
		JSON.stringify({ body: markedBody(comment.body, now) }),
	)
}

export function parseBadLabelLedger(value: unknown): Record<string, string> {
	if (typeof value !== "object" || value === null) return {}

	const entries = Object.entries(value).filter(
		(entry): entry is [string, string] => typeof entry[1] === "string",
	)

	return Object.fromEntries(entries)
}

export function unseenBadLabels(
	badLabels: readonly BadLabels[],
	ledger: Record<string, string>,
): BadLabels[] {
	return badLabels.filter((entry) => ledger[String(entry.issue)] !== entry.labels)
}
