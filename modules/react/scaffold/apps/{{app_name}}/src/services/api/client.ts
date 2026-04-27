import { env } from "@/config/env";
import { createApiClient } from "@{{project_name}}/api/client";

export const api = createApiClient(env.VITE_API_URL);
