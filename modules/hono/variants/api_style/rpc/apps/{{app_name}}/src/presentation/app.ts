import { Hono } from "hono";
import type { Bindings } from "../infrastructure/env";
import {
	type RepositoryVariables,
	repositoriesMiddleware,
} from "./middleware/repositories";
import { postRoutes } from "./routes/post-routes";

export const app = new Hono<{
	Bindings: Bindings;
	Variables: RepositoryVariables;
}>()
	.use("*", repositoriesMiddleware)
	.route("/", postRoutes);
