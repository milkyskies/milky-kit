import { OpenAiClient, OpenAiLanguageModel } from "@effect/ai-openai-compat"
import { Config, Context, Effect, Layer, type Schema } from "effect"
import { type AiError, LanguageModel } from "effect/ai"
import { FetchHttpClient } from "effect/http"
import { AI } from "./ai-config"

const OpenAiClientLive = OpenAiClient.layerConfig({
	apiKey: Config.Redacted(AI.apiKeyEnv),
	apiUrl: Config.succeed(AI.baseUrl),
}).pipe(Layer.provide(FetchHttpClient.layer))

const LanguageModelLive = OpenAiLanguageModel.layer({ model: AI.model }).pipe(
	Layer.provide(OpenAiClientLive),
)

export class AiService extends Context.Service<
	AiService,
	{
		readonly complete: (prompt: string) => Effect.Effect<string, AiError.AiError>
		readonly structured: <S extends Schema.Encoder<Record<string, unknown>, unknown>>(
			prompt: string,
			schema: S,
		) => Effect.Effect<S["Type"], AiError.AiError, S["DecodingServices"]>
	}
>()("AiService") {
	static readonly layer = Layer.effect(
		AiService,
		Effect.gen(function* () {
			const model = yield* LanguageModel.LanguageModel

			return AiService.of({
				complete: (prompt) =>
					model.generateText({ prompt }).pipe(Effect.map((response) => response.text)),
				structured: (prompt, schema) =>
					model.generateObject({ prompt, schema }).pipe(Effect.map((response) => response.value)),
			})
		}),
	).pipe(Layer.provide(LanguageModelLive))
}
