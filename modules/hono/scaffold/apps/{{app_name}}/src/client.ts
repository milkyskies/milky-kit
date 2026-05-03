import { hc } from "hono/client";
import type { AppType } from "./app";

export type { AppType };

export const createApiClient = (baseUrl: string) => hc<AppType>(baseUrl);
