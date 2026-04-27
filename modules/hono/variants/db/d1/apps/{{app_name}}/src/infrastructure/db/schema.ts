import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const postsTable = sqliteTable(
	"posts",
	{
		id: text("id").primaryKey(),
		title: text("title").notNull(),
		body: text("body").notNull(),
		publishedAt: integer("published_at", { mode: "timestamp" }),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(t) => [index("idx_posts_created_at").on(t.createdAt)],
);
