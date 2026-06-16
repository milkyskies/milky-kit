import { LanguageModel } from "@effect/ai"
import { OpenAiClient, OpenAiLanguageModel } from "@effect/ai-openai"
import { FetchHttpClient } from "@effect/platform"
import { Config, Effect, Layer, type Schema } from "effect"
import { AI } from "./ai-config"

// OpenAI-compatible client pointed at the configured base URL (OpenRouter or a
// local Ollama). Key comes from the env var named in the AI preset.
const OpenAiClientLive = OpenAiClient.layerConfig({
	apiKey: Config.redacted(AI.apiKeyEnv),
	apiUrl: Config.succeed(AI.baseUrl),
}).pipe(Layer.provide(FetchHttpClient.layer))

// The active LanguageModel, selected from the AI constant.
const LanguageModelLive = OpenAiLanguageModel.layer({ model: AI.model }).pipe(
	Layer.provide(OpenAiClientLive),
)

/**
 * Provider-agnostic AI service. Call sites depend on this, never on a specific
 * provider — swap provider/model in `ai-config.ts` and nothing here changes.
 *   - `complete(prompt)` → text.
 *   - `structured(prompt, schema)` → a value validated against the Schema (the
 *     model is forced to produce that shape; decode happens at the boundary).
 */
export class AiService extends Effect.Service<AiService>()("AiService", {
	dependencies: [LanguageModelLive],
	effect: Effect.gen(function* () {
		const model = yield* LanguageModel.LanguageModel

		return {
			complete: (prompt: string) =>
				model.generateText({ prompt }).pipe(Effect.map((response) => response.text)),
			structured: <A, I extends Record<string, unknown>>(
				prompt: string,
				schema: Schema.Schema<A, I>,
			) => model.generateObject({ prompt, schema }).pipe(Effect.map((response) => response.value)),
		}
	}),
}) {}
