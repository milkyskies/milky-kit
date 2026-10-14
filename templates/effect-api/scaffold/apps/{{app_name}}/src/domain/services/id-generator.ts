import { Context, Effect, Layer } from "effect"

export class IdGenerator extends Context.Service<
	IdGenerator,
	{
		readonly nextId: () => Effect.Effect<string>
	}
>()("IdGenerator") {}

export const IdGeneratorLive = Layer.succeed(IdGenerator, {
	nextId: () => Effect.sync(() => Bun.randomUUIDv7()),
})
