import { hc } from "hono/client";
import type { app } from "./presentation/routes";

export type AppType = typeof app;

export const createApiClient = (baseUrl: string) => hc<AppType>(baseUrl);
