import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
	appId: "com.{{project_name}}.{{app_name}}",
	appName: "{{project_name}}-{{app_name}}",
	webDir: "dist",
	server: {
		androidScheme: "https",
	},
};

export default config;
