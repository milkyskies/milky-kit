import { differenceInSeconds } from "date-fns"
import { ServiceStatus } from "../../domain/models/service-status"

export function getStatus(startedAt: Date, now: Date): ServiceStatus {
	return new ServiceStatus({
		status: "ok",
		uptimeSeconds: Math.max(0, differenceInSeconds(now, startedAt)),
	})
}
