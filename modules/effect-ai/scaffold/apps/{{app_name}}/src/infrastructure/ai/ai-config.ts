/**
 * AI provider config. OpenRouter (cloud) and a self-hosted Ollama both
 * speak the OpenAI-compatible API, so one OpenAI client + a base URL
 * covers both. Switch provider by changing `AI` to another preset; change
 * the model by editing its `model`. Each preset names the env var holding
 * its key (see .env.example). Ollama ignores the key — any value works.
 */
const PROVIDERS = {
	openrouter: {
		baseUrl: "https://openrouter.ai/api/v1",
		model: "anthropic/claude-sonnet-4.5",
		apiKeyEnv: "OPENROUTER_API_KEY",
	},
	ollama: {
		baseUrl: "http://localhost:11434/v1",
		model: "llama3.1",
		apiKeyEnv: "OLLAMA_API_KEY",
	},
} as const

export const AI = PROVIDERS.openrouter
