import { pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const postsTable = pgTable("posts", {
	id: text("id").primaryKey(),
	title: text("title").notNull(),
	body: text("body").notNull(),
	publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
		.notNull()
		.defaultNow(),
})

export type PostRow = typeof postsTable.$inferSelect
export type PostInsertRow = typeof postsTable.$inferInsert
