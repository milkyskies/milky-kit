import { firstFailingLine, type Shell } from "../merge/shell.ts"
import type { FrontdeskSection } from "./section.ts"

export type AfterLand =
	| { kind: "passed"; command: string }
	| { kind: "failed"; command: string; reason: string }
	| { kind: "unreadable"; reason: string }

export type RootUpdate =
	| { kind: "skipped"; root: string | undefined; reason: string }
	| { kind: "failed"; root: string; reason: string }
	| { kind: "pulled"; root: string; afterLand: AfterLand | undefined }

type MainWorktree = { path: string; branch: string | undefined }

const PULL_TIMEOUT_MS = 2 * 60_000
const AFTER_LAND_TIMEOUT_MS = 20 * 60_000

function parseMainWorktree(porcelain: string): MainWorktree | undefined {
	const lines = (porcelain.split(/\r?\n\r?\n/)[0] ?? "").split(/\r?\n/)
	const path = lines.find((line) => line.startsWith("worktree "))?.slice("worktree ".length)
	if (path === undefined) return undefined

	const branch = lines
		.find((line) => line.startsWith("branch "))
		?.slice("branch ".length)
		.replace(/^refs\/heads\//, "")

	return { path, branch }
}

async function runAfterLand(
	shell: Shell,
	loadSection: () => Promise<FrontdeskSection>,
	root: string,
): Promise<AfterLand | undefined> {
	let command: string | undefined
	try {
		command = (await loadSection()).coordinator.afterLand
	} catch (error) {
		return { kind: "unreadable", reason: error instanceof Error ? error.message : String(error) }
	}

	if (command === undefined) return undefined

	const result = await shell(["sh", "-c", command], root, { timeoutMs: AFTER_LAND_TIMEOUT_MS })
	if (result.timedOut) return { kind: "failed", command, reason: "timed out after 20 minutes" }
	if (result.code !== 0) return { kind: "failed", command, reason: firstFailingLine(result) }

	return { kind: "passed", command }
}

export async function updateRootCheckout(
	shell: Shell,
	loadSection: () => Promise<FrontdeskSection>,
): Promise<RootUpdate> {
	const listed = await shell(["git", "worktree", "list", "--porcelain"])
	const main = listed.code === 0 ? parseMainWorktree(listed.stdout) : undefined
	if (main === undefined) {
		return {
			kind: "skipped",
			root: undefined,
			reason: `git worktree list does not name it: ${firstFailingLine(listed)}`,
		}
	}

	if (main.branch !== "main") {
		const where = main.branch === undefined ? "not on a branch" : `on ${main.branch}`

		return { kind: "skipped", root: main.path, reason: `it is ${where}, not main` }
	}

	// A fast-forward-only pull refuses rather than overwrite local changes or merge a diverged branch, so the human's own work in the root is never touched.
	const pulled = await shell(
		["git", "-C", main.path, "pull", "--ff-only", "origin", "main"],
		undefined,
		{ timeoutMs: PULL_TIMEOUT_MS },
	)
	if (pulled.code !== 0 || pulled.timedOut) {
		const reason = pulled.timedOut ? "git pull timed out" : firstFailingLine(pulled)

		return { kind: "failed", root: main.path, reason }
	}

	return {
		kind: "pulled",
		root: main.path,
		afterLand: await runAfterLand(shell, loadSection, main.path),
	}
}

function describeAfterLand(afterLand: AfterLand): string {
	switch (afterLand.kind) {
		case "passed":
			return `after land: \`${afterLand.command}\` passed`
		case "failed":
			return `after land: \`${afterLand.command}\` failed: ${afterLand.reason}`
		case "unreadable":
			return `after land: not run, the ## frontdesk section cannot be read: ${afterLand.reason}`
		default: {
			const _exhaustive: never = afterLand

			return _exhaustive
		}
	}
}

export function describeRootUpdate(update: RootUpdate): string[] {
	switch (update.kind) {
		case "skipped":
			return [
				update.root === undefined
					? `root checkout not updated: ${update.reason}`
					: `root checkout ${update.root} not updated: ${update.reason}`,
			]
		case "failed":
			return [`root checkout ${update.root} not updated, left as it was: ${update.reason}`]
		case "pulled":
			return [
				`root checkout ${update.root} fast-forwarded to origin/main`,
				...(update.afterLand === undefined ? [] : [describeAfterLand(update.afterLand)]),
			]
		default: {
			const _exhaustive: never = update

			return _exhaustive
		}
	}
}
