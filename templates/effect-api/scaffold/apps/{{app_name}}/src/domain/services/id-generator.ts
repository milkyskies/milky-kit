import { Context, Effect, Layer } from "effect"

/**
 * Pure domain service: generates new entity IDs. Wrapped as a service so
 * tests can inject deterministic IDs without monkey-patching nanoid.
 */
export class IdGenerator extends Context.Tag("IdGenerator")<
	IdGenerator,
	{
		readonly nextId: () => Effect.Effect<string>
	}
>() {}

const randomId = (prefix: string): Effect.Effect<string> =>
	Effect.sync(() => {
		const random = crypto.getRandomValues(new Uint8Array(12))
		const hex = Array.from(random, (b) => b.toString(16).padStart(2, "0")).join("")
		return `${prefix}_${hex}`
	})

export const IdGeneratorLive = Layer.succeed(IdGenerator, {
	nextId: () => randomId("p"),
})
