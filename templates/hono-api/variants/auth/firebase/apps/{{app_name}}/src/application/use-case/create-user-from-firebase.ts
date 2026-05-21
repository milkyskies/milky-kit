import { Option } from "effect"
import { nanoid } from "nanoid"
import type { User } from "../../domain/models/user"
import type { UserRepository } from "../../domain/repositories/user-repository"
import { UserAlreadyExists } from "../errors"

export type CreateUserFromFirebaseInput = {
	firebaseUid: string
	email: Option.Option<string>
	displayName: string
	avatarUrl: Option.Option<string>
}

export async function createUserFromFirebase(
	users: UserRepository,
	input: CreateUserFromFirebaseInput,
): Promise<User> {
	const existing = await users.findByFirebaseUid(input.firebaseUid)
	if (Option.isSome(existing)) {
		throw new UserAlreadyExists({ firebaseUid: input.firebaseUid })
	}

	return users.create({
		id: nanoid(),
		firebaseUid: Option.some(input.firebaseUid),
		email: input.email,
		displayName: input.displayName,
		avatarUrl: input.avatarUrl,
	})
}
