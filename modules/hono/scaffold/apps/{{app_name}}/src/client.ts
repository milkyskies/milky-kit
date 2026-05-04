import { type ClientRequestOptions, hc } from "hono/client";
import type { AppType } from "./app";

export type { AppType };

// Second arg forwards Hono's `hc` options (e.g. `{ fetch: authedFetch }`)
// so consumers can swap the underlying fetch — used by the React app to
// attach auth headers + retry on 401.
export const createApiClient = (
	baseUrl: string,
	options?: ClientRequestOptions,
) => hc<AppType>(baseUrl, options);
