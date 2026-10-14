import { Data, Option } from "effect"

export type MeApiDto = {
	id: string
	email: string | null
	displayName: string
	avatarUrl: string | null
	createdAt: string
	updatedAt: string
}

export class Me extends Data.Class<{
	readonly id: string
	readonly email: Option.Option<string>
	readonly displayName: string
	readonly avatarUrl: Option.Option<string>
	readonly createdAt: Date
	readonly updatedAt: Date
}> {
	static fromApi(dto: MeApiDto): Me {
		return new Me({
			id: dto.id,
			email: Option.fromNullishOr(dto.email),
			displayName: dto.displayName,
			avatarUrl: Option.fromNullishOr(dto.avatarUrl),
			createdAt: new Date(dto.createdAt),
			updatedAt: new Date(dto.updatedAt),
		})
	}
}
