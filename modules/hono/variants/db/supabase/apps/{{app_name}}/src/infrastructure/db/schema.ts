import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const postsTable = pgTable(
	"posts",
	{
		id: text("id").primaryKey(),
		title: text("title").notNull(),
		body: text("body").notNull(),
		publishedAt: timestamp("published_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [index("idx_posts_created_at").on(t.createdAt)],
);
