import { createMiddleware } from "hono/factory";
import type { PostRepository } from "../../domain/repositories/post-repository";
import {
	type Bindings,
	makePostRepository,
} from "../../infrastructure/db/post-repository";

export type RepositoryVariables = {
	postRepository: PostRepository;
};

export const repositoriesMiddleware = createMiddleware<{
	Bindings: Bindings;
	Variables: RepositoryVariables;
}>(async (context, next) => {
	context.set("postRepository", makePostRepository(context.env));
	await next();
});
