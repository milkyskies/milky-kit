import { desc, eq } from "drizzle-orm"
import { Option } from "effect"
import { Post } from "../../domain/models/post"
import type { NewPost, PostPatch, PostRepository } from "../../domain/repositories/post-repository"
import type { Database } from "./database"
import { postsTable } from "./schema"

type PostRow = typeof postsTable.$inferSelect

const fromRow = (row: PostRow): Post =>
	Post.make({
		id: row.id,
		title: row.title,
		body: row.body,
		publishedAt: Option.fromNullable(row.publishedAt),
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	})

export const makePostRepository = (db: Database): PostRepository => ({
	findAll: async () => {
		const rows = await db.select().from(postsTable).orderBy(desc(postsTable.createdAt))
		return rows.map(fromRow)
	},

	findById: async (id) => {
		const row = await db.select().from(postsTable).where(eq(postsTable.id, id)).get()
		if (!row) return Option.none()
		return Option.some(fromRow(row))
	},

	create: async (input: NewPost) => {
		const now = new Date()
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
			.returning()
		if (!row) throw new Error("Insert into posts returned no rows")

		return fromRow(row)
	},

	update: async (id, patch: PostPatch) => {
		const updates: Partial<typeof postsTable.$inferInsert> = {
			updatedAt: new Date(),
		}
		if (Option.isSome(patch.title)) updates.title = patch.title.value
		if (Option.isSome(patch.body)) updates.body = patch.body.value

		const [row] = await db.update(postsTable).set(updates).where(eq(postsTable.id, id)).returning()

		if (!row) return Option.none()
		return Option.some(fromRow(row))
	},

	delete: async (id) => {
		const result = await db
			.delete(postsTable)
			.where(eq(postsTable.id, id))
			.returning({ id: postsTable.id })
		return result.length > 0
	},
})
