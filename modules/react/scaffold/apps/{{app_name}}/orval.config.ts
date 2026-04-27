import { defineConfig } from "orval";

export default defineConfig({
	api: {
		input: "./openapi.json",
		output: {
			mode: "tags-split",
			workspace: "./src/services/api/_generated",
			schemas: "./schemas",
			target: ".",
			client: "axios",
			fileExtension: ".ts",
			override: {
				mutator: {
					path: "./axios-instance.ts",
					name: "customInstance",
				},
			},
		},
	},
});
