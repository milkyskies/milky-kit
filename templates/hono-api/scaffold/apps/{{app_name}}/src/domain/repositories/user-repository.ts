import type { Option } from "effect"
import type { User } from "../models/user"

export type NewUser = {
	id: string
	firebaseUid: Option.Option<string>
	email: Option.Option<string>
	displayName: string
	avatarUrl: Option.Option<string>
}

export type UserPatch = {
	email: Option.Option<string>
	displayName: Option.Option<string>
	avatarUrl: Option.Option<string>
}

export type UserRepository = {
	findById: (id: string) => Promise<Option.Option<User>>
	findByFirebaseUid: (firebaseUid: string) => Promise<Option.Option<User>>
	findByEmail: (email: string) => Promise<Option.Option<User>>
	create: (user: NewUser) => Promise<User>
	update: (id: string, patch: UserPatch) => Promise<Option.Option<User>>
}
