import { OpenAPIHono } from "@hono/zod-openapi";
import type { Bindings } from "../infrastructure/env";
import {
	type RepositoryVariables,
	repositoriesMiddleware,
} from "./middleware/repositories";
import { postRoutes } from "./routes/post-routes";

export const app = new OpenAPIHono<{
	Bindings: Bindings;
	Variables: RepositoryVariables;
}>();

app.use("*", repositoriesMiddleware);
app.route("/", postRoutes);

app.doc("/openapi.json", {
	openapi: "3.0.0",
	info: { title: "{{project_name}} API", version: "1.0.0" },
});
