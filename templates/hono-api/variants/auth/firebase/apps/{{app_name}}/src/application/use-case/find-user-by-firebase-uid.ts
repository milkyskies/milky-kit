import type { Option } from "effect"
import type { User } from "../../domain/models/user"
import type { UserRepository } from "../../domain/repositories/user-repository"

export async function findUserByFirebaseUid(
	users: UserRepository,
	firebaseUid: string,
): Promise<Option.Option<User>> {
	return users.findByFirebaseUid(firebaseUid)
}
