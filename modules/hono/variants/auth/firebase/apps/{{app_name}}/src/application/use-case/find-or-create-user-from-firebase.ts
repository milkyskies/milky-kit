import { Option } from "effect";
import { nanoid } from "nanoid";
import type { User } from "../../domain/models/user";
import type { UserRepository } from "../../domain/repositories/user-repository";

export type FindOrCreateUserFromFirebaseInput = {
	firebaseUid: string;
	email: Option.Option<string>;
	displayName: Option.Option<string>;
	avatarUrl: Option.Option<string>;
};

export async function findOrCreateUserFromFirebase(
	users: UserRepository,
	input: FindOrCreateUserFromFirebaseInput,
): Promise<User> {
	const existing = await users.findByFirebaseUid(input.firebaseUid);
	if (Option.isSome(existing)) return existing.value;

	const displayName = Option.match(input.displayName, {
		onNone: () =>
			Option.match(input.email, {
				onNone: () => `user-${input.firebaseUid.slice(0, 8)}`,
				onSome: (email) => email.split("@")[0] ?? email,
			}),
		onSome: (name) => name,
	});

	return users.create({
		id: nanoid(),
		firebaseUid: Option.some(input.firebaseUid),
		email: input.email,
		displayName,
		avatarUrl: input.avatarUrl,
	});
}
