import { Data, type Option } from "effect"

export interface User {
	readonly id: string
	readonly firebaseUid: Option.Option<string>
	readonly email: Option.Option<string>
	readonly displayName: string
	readonly avatarUrl: Option.Option<string>
	readonly createdAt: Date
	readonly updatedAt: Date
}

export const User = {
	make: Data.case<User>(),
}
