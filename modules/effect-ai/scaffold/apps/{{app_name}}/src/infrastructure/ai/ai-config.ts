// OpenRouter and a self-hosted Ollama both speak the OpenAI-compatible API, so one client plus a base URL covers both.
// Ollama ignores the key, so any value works.
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
