import { createMiddleware } from "hono/factory";
import type { PostRepository } from "../../domain/repositories/post-repository";
import { makeDatabase } from "../../infrastructure/db/database";
import { makePostRepository } from "../../infrastructure/db/post-repository";
import type { Bindings } from "../../infrastructure/env";

export type RepositoryVariables = {
	postRepository: PostRepository;
};

export const repositoriesMiddleware = createMiddleware<{
	Bindings: Bindings;
	Variables: RepositoryVariables;
}>(async (context, next) => {
	const db = makeDatabase(context.env);
	context.set("postRepository", makePostRepository(db));
	await next();
});
