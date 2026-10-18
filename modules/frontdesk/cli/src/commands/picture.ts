import { basename } from "node:path"
import { parseArgs } from "node:util"

import { parseNumber, parseOrUsage, requireFlag } from "../args.ts"
import { type Command, emit } from "../context.ts"
import { mismatch, usageError } from "../errors.ts"
import { type Gh, GhError, type Repo, repoSlug } from "../github/gh.ts"
import { parseJson, readString } from "../json.ts"

const BRANCH = "desk-pictures"

async function exists(gh: Gh, path: string): Promise<boolean> {
	try {
		await gh(["api", path])

		return true
	} catch (error) {
		if (error instanceof GhError && error.notFound) return false

		throw error
	}
}

async function post(gh: Gh, path: string, payload: unknown): Promise<string> {
	return gh(["api", "-X", "POST", path, "--input", "-"], JSON.stringify(payload))
}

async function createOrphanBranch(gh: Gh, repo: Repo): Promise<void> {
	const base = `repos/${repoSlug(repo)}`
	const blob = await post(gh, `${base}/git/blobs`, {
		content: "Pictures uploaded by frontdesk. Deleting this branch prunes every picture.\n",
		encoding: "utf-8",
	})
	const tree = await post(gh, `${base}/git/trees`, {
		tree: [
			{ path: "README.md", mode: "100644", type: "blob", sha: readString(parseJson(blob), "sha") },
		],
	})
	const commit = await post(gh, `${base}/git/commits`, {
		message: "frontdesk: create the pictures branch",
		tree: readString(parseJson(tree), "sha"),
		parents: [],
	})

	await post(gh, `${base}/git/refs`, {
		ref: `refs/heads/${BRANCH}`,
		sha: readString(parseJson(commit), "sha"),
	})
}

async function fileSha(gh: Gh, contentsPath: string): Promise<string | undefined> {
	try {
		return readString(parseJson(await gh(["api", `${contentsPath}?ref=${BRANCH}`])), "sha")
	} catch (error) {
		if (error instanceof GhError && error.notFound) return undefined

		throw error
	}
}

export const run: Command = async (args, context) => {
	const { positionals } = parseOrUsage("picture", () => parseArgs({ args, allowPositionals: true }))
	const number = parseNumber("picture", positionals[0], "the issue number")
	const file = requireFlag("picture", positionals[1], "the picture file")

	const { gh, repo } = context
	const base = `repos/${repoSlug(repo)}`
	const bytes = await context.readBytes(file).catch(() => undefined)
	if (bytes === undefined) throw usageError("picture", `cannot read file ${file}`)

	if (!(await exists(gh, `${base}/git/ref/heads/${BRANCH}`))) await createOrphanBranch(gh, repo)

	const name = basename(file)
	const contentsPath = `${base}/contents/${number}/${encodeURIComponent(name)}`
	const existingSha = await fileSha(gh, contentsPath)

	await gh(
		["api", "-X", "PUT", contentsPath, "--input", "-"],
		JSON.stringify({
			message: `frontdesk: picture for #${number}`,
			content: Buffer.from(bytes).toString("base64"),
			branch: BRANCH,
			...(existingSha === undefined ? {} : { sha: existingSha }),
		}),
	)

	if ((await fileSha(gh, contentsPath)) === undefined) {
		throw mismatch(
			"picture",
			number,
			"no picture on the branch",
			"no picture on the branch",
			`${number}/${name} on ${BRANCH}`,
		)
	}

	const url = `https://github.com/${repoSlug(repo)}/blob/${BRANCH}/${number}/${encodeURIComponent(name)}?raw=true`

	emit(context, url, { issue: number, url })
}
