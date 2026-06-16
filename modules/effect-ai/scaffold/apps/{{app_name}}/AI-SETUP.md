# AI setup

This project includes a provider-agnostic `AiService` (`src/infrastructure/ai/`).
Two one-time steps:

1. **Install the AI packages:**

   ```sh
   bun add @effect/ai @effect/ai-openai
   ```

2. **Set the provider key.** The default preset (`ai-config.ts`) is OpenRouter, which
   reads `OPENROUTER_API_KEY`. Add it to `.env` (and `.env.example` as a blank
   placeholder):

   ```sh
   OPENROUTER_API_KEY=
   ```

   To use a local Ollama instead, switch `export const AI = PROVIDERS.ollama` in
   `ai-config.ts` (no key needed).

## Use it

`AiService` is an Effect service — depend on it from a use case, provide
`AiService.Default` at the composition root:

```ts
const ai = yield* AiService
const summary = yield* ai.complete("Summarize: ...")
const parsed = yield* ai.structured("Extract the invoice fields: ...", InvoiceSchema)
```

```ts
// app-live.ts
export const AppLive = HttpServerLive.pipe(
  Layer.provide(AiService.Default),
  // ...existing provides
)
```
