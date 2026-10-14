# AI setup

This project includes a provider-agnostic `AiService` (`src/infrastructure/ai/`).
Two one-time steps:

1. **Install the AI packages:**

   ```sh
   pnpm add @effect/ai-openai-compat
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
`AiService.layer` at the composition root. The `effect/ai` modules ship inside
`effect`, so only the provider package is a separate install:

```ts
const ai = yield* AiService
const summary = yield* ai.complete("Summarize: ...")
const parsed = yield* ai.structured("Extract the invoice fields: ...", InvoiceSchema)
```

```ts
// app-live.ts
export const AppLive = HttpServerLive.pipe(
  Layer.provide(AiService.layer),
  // ...existing provides
)
```
