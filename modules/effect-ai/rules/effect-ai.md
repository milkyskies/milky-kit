# AI: provider-agnostic LLM via `@effect/ai`

This module adds LLM access as a single Effect service. The point is that call sites
never know which provider/model is behind it — that lives in one config constant.

## Shape

```
src/infrastructure/ai/
├── ai-config.ts    The `AI` constant: provider presets (baseUrl, model, apiKeyEnv).
└── ai-service.ts   `AiService` (complete + structured), built from `AI`.
```

## Rules

- **One config constant controls provider + model.** Swap OpenRouter ↔ Ollama ↔ any
  OpenAI-compatible endpoint, or change the model, by editing `ai-config.ts` only.
  Never hardcode a model id or base URL at a call site.
- **Depend on `AiService`, never on a provider.** Business logic yields `AiService`
  and calls `complete` / `structured`. No use case imports `@effect/ai-openai` or
  builds an HTTP client. Provide `AiService.Default` once at the composition root.
- **Keys via `Config.redacted`.** The provider key is read through `Config` from the
  env var named in the preset — never `process.env` directly, never a plain string.
- **`structured` for anything parsed.** When you need fields back, pass a `Schema` to
  `ai.structured(prompt, schema)` — the model is constrained to that shape and you
  get a validated value, not a string you parse by hand. This is the boundary decode.
- **Judgment-heavy work is detect → decide → apply.** Deterministic code finds
  candidates and applies the result; the LLM only supplies the judgment in between.
  The model never hand-writes mutations.
- **Cache + background expensive calls.** An LLM call per request is slow and costs
  money. For batch/asynchronous judgment, enqueue it (see the queue module) and cache
  the result keyed by a hash of the prompt inputs so it runs once per input-state.

See AI-SETUP.md (scaffolded at the app root) for install + key setup.
