import { Data } from "effect"

export class ServiceStatus extends Data.Class<{
	readonly status: "ok"
	readonly uptimeSeconds: number
}> {}
