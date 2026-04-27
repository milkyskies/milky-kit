import { Option } from "effect";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { desc, eq } from "drizzle-orm";
import { postsTable } from "./schema";
import { Post } from "../../domain/models/post";
import type {
	NewPost,
	PostPatch,
	PostRepository,
} from "../../domain/repositories/post-repository";

export const makeNeonPostRepository = (databaseUrl: string): PostRepository => {
	const sql = neon(databaseUrl);
	const db = drizzle(sql);

	return {
		findAll: async () => {
			const rows = await db
				.select()
				.from(postsTable)
				.orderBy(desc(postsTable.createdAt));
			return rows.map(Post.fromRow);
		},

		findById: async (id) => {
			const rows = await db
				.select()
				.from(postsTable)
				.where(eq(postsTable.id, id))
				.limit(1);
			const row = rows[0];
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
