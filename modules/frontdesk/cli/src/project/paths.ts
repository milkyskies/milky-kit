import { join } from "node:path"

import type { Repo } from "../github/gh.ts"

export function projectStateDirectory(home: string, repo: Repo): string {
	return join(home, ".local", "state", "frontdesk", `${repo.owner}__${repo.name}`)
}

export function coordinatorLockPath(home: string, repo: Repo): string {
	return join(projectStateDirectory(home, repo), "coordinator.lock")
}

export function preflightPingRecordPath(home: string, repo: Repo): string {
	return join(projectStateDirectory(home, repo), "preflight-pinged.json")
}

export function userEnvironmentPath(home: string): string {
	return join(home, ".config", "frontdesk", ".env")
}
