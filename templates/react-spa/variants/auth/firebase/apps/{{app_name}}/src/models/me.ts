import { Data, Option } from "effect";

export interface Me {
	readonly id: string;
	readonly email: Option.Option<string>;
	readonly displayName: string;
	readonly avatarUrl: Option.Option<string>;
	readonly createdAt: Date;
	readonly updatedAt: Date;
}

export type MeApiDto = {
	id: string;
	email: string | null;
	displayName: string;
	avatarUrl: string | null;
	createdAt: string;
	updatedAt: string;
};

export const Me = {
	make: Data.case<Me>(),

	fromApi: (dto: MeApiDto): Me =>
		Me.make({
			id: dto.id,
			email: Option.fromNullable(dto.email),
			displayName: dto.displayName,
			avatarUrl: Option.fromNullable(dto.avatarUrl),
			createdAt: new Date(dto.createdAt),
			updatedAt: new Date(dto.updatedAt),
		}),
};
