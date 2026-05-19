import { Effect, Layer, Option } from "effect"
import { describe, expect, it } from "@effect/vitest"
import { Post } from "@/domain/models/post"
import { IdGenerator } from "@/domain/services/id-generator"
import { PostRepository } from "@/domain/repositories/post-repository"
import { createPost } from "./create-post"

const StubIdGenerator = Layer.succeed(IdGenerator, {
	nextId: () => Effect.succeed("p_test"),
})

const InMemoryPostRepository = Layer.succeed(PostRepository, {
	findAll: () => Effect.succeed([]),
	findById: () => Effect.succeed(Option.none()),
	create: (input) =>
		Effect.succeed(
			new Post({
				id: input.id,
				title: input.title,
				body: input.body,
				publishedAt: input.publishedAt,
				createdAt: new Date(0),
				updatedAt: new Date(0),
			}),
		),
	update: () => Effect.die("not implemented"),
	delete: () => Effect.die("not implemented"),
})

const TestLive = Layer.mergeAll(StubIdGenerator, InMemoryPostRepository)

describe("createPost", () => {
	it.effect("creates a post with the generated id", () =>
		Effect.gen(function* () {
			const post = yield* createPost({
				title: "Hello",
				body: "World",
				publishedAt: Option.none(),
			})

			expect(post.id).toBe("p_test")
			expect(post.title).toBe("Hello")
			expect(post.isPublished).toBe(false)
		}).pipe(Effect.provide(TestLive)),
	)
})
