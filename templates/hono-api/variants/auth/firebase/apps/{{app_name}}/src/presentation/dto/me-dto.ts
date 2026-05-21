import { Option } from "effect"
import { z } from "zod"
import type { User } from "../../domain/models/user"

export const createMeSchema = z.object({
	displayName: z.string().min(1).max(40),
})

export type CreateMeDto = z.infer<typeof createMeSchema>

export type MeDto = {
	id: string
	email: string | null
	displayName: string
	avatarUrl: string | null
	createdAt: string
	updatedAt: string
}

export const toMeDto = (user: User): MeDto => ({
	id: user.id,
	email: Option.getOrNull(user.email),
	displayName: user.displayName,
	avatarUrl: Option.getOrNull(user.avatarUrl),
	createdAt: user.createdAt.toISOString(),
	updatedAt: user.updatedAt.toISOString(),
})
