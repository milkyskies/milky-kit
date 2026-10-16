export type Gh = (args: readonly string[], input?: string) => Promise<string>

export class GhError extends Error {
	readonly args: readonly string[]
	readonly status: number | undefined

	constructor(args: readonly string[], stderr: string, status?: number) {
		super(`gh ${args.slice(0, 3).join(" ")} failed: ${stderr.trim()}`)
		this.args = args
		this.status = status
	}

	get notFound(): boolean {
		return this.message.includes("HTTP 404") || this.message.includes("Not Found")
	}
}

export const spawnGh: Gh = async (args, input) => {
	const child = Bun.spawn(["gh", ...args], {
		stdin: input === undefined ? "ignore" : new Blob([input]),
		stdout: "pipe",
		stderr: "pipe",
	})

	const [stdout, stderr, status] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	])

	if (status !== 0) throw new GhError(args, stderr || stdout, status)

	return stdout
}

export type Repo = { owner: string; name: string }

export function repoSlug(repo: Repo): string {
	return `${repo.owner}/${repo.name}`
}

export function parseRepo(slug: string): Repo {
	const [owner, name, ...rest] = slug.trim().split("/")
	if (!owner || !name || rest.length > 0) {
		throw new Error(`"${slug}" is not an owner/name repository`)
	}

	return { owner, name }
}

export async function resolveRepo(gh: Gh, flag: string | undefined): Promise<Repo> {
	if (flag !== undefined) return parseRepo(flag)

	const slug = await gh(["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"])

	return parseRepo(slug)
}
