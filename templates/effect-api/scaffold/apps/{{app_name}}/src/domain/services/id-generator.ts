import { Context, Effect, Layer } from "effect"

/**
 * Generates new entity IDs. Wrapped as a service so tests can inject deterministic IDs.
 */
export class IdGenerator extends Context.Tag("IdGenerator")<
	IdGenerator,
	{
		readonly nextId: () => Effect.Effect<string>
	}
>() {}

export const IdGeneratorLive = Layer.succeed(IdGenerator, {
	nextId: () => Effect.sync(() => Bun.randomUUIDv7()),
})
