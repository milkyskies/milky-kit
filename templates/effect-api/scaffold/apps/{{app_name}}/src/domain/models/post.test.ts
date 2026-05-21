import { describe, expect, it } from "@effect/vitest"
import { Option } from "effect"
import { Post } from "./post"

describe("Post", () => {
	it("is published when publishedAt is Some", () => {
		const post = new Post({
			id: "p_1",
			title: "Hello",
			body: "World",
			publishedAt: Option.some(new Date("2026-01-01T00:00:00Z")),
			createdAt: new Date(),
			updatedAt: new Date(),
		})

		expect(post.isPublished).toBe(true)
	})

	it("is not published when publishedAt is None", () => {
		const post = new Post({
			id: "p_1",
			title: "Hello",
			body: "World",
			publishedAt: Option.none(),
			createdAt: new Date(),
			updatedAt: new Date(),
		})

		expect(post.isPublished).toBe(false)
	})
})
