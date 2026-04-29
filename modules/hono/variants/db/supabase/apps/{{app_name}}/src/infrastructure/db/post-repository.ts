import type { Hyperdrive } from "@cloudflare/workers-types";
import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { Option } from "effect";
import postgres from "postgres";
import { Post } from "../../domain/models/post";
import type {
	NewPost,
	PostPatch,
	PostRepository,
} from "../../domain/repositories/post-repository";
import { postsTable } from "./schema";

export type Bindings = { HYPERDRIVE: Hyperdrive };

export const makePostRepository = (env: Bindings): PostRepository => {
	const sql = postgres(env.HYPERDRIVE.connectionString, {
		// Hyperdrive recommends max=5 and disabling fetch_types for serverless.
		max: 5,
		fetch_types: false,
	});
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
