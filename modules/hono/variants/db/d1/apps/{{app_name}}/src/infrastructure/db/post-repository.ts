import type { D1Database } from "@cloudflare/workers-types";
import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Option } from "effect";
import { Post } from "../../domain/models/post";
import type {
	NewPost,
	PostPatch,
	PostRepository,
} from "../../domain/repositories/post-repository";
import { postsTable } from "./schema";

export type Bindings = { DB: D1Database };

export const makePostRepository = (env: Bindings): PostRepository => {
	const db = drizzle(env.DB);

	return {
		findAll: async () => {
			const rows = await db
				.select()
				.from(postsTable)
				.orderBy(desc(postsTable.createdAt));
			return rows.map(Post.fromRow);
		},

		findById: async (id) => {
			const row = await db
				.select()
				.from(postsTable)
				.where(eq(postsTable.id, id))
				.get();
			if (!row) return Option.none();
			return Option.some(Post.fromRow(row));
		},

		create: async (input: NewPost) => {
			const now = new Date();
			const [row] = await db
				.insert(postsTable)
				.values({
					id: input.id,
					title: input.title,
					body: input.body,
					publishedAt: Option.getOrNull(input.publishedAt),
					createdAt: now,
					updatedAt: now,
				})
				.returning();
			return Post.fromRow(row);
		},

		update: async (id, patch: PostPatch) => {
			const updates: Partial<typeof postsTable.$inferInsert> = {
				updatedAt: new Date(),
			};
			Option.match(patch.title, {
				onNone: () => {},
				onSome: (v) => {
					updates.title = v;
				},
			});
			Option.match(patch.body, {
				onNone: () => {},
				onSome: (v) => {
					updates.body = v;
				},
			});

			const [row] = await db
				.update(postsTable)
				.set(updates)
				.where(eq(postsTable.id, id))
				.returning();

			if (!row) return Option.none();
			return Option.some(Post.fromRow(row));
		},

		delete: async (id) => {
			const result = await db
				.delete(postsTable)
				.where(eq(postsTable.id, id))
				.returning({ id: postsTable.id });
			return result.length > 0;
		},
	};
};
