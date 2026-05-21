import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const postsTable = pgTable(
	"posts",
	{
		id: text("id").primaryKey(),
		title: text("title").notNull(),
		body: text("body").notNull(),
		publishedAt: timestamp("published_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("idx_posts_created_at").on(t.createdAt)],
)

// Always present so the auth=firebase variant's user-repository compiles
// regardless of which auth strategy is selected. Idle when auth=none.
export const usersTable = pgTable(
	"users",
	{
		id: text("id").primaryKey(),
		firebaseUid: text("firebase_uid").unique(),
		email: text("email").unique(),
		displayName: text("display_name").notNull(),
		avatarUrl: text("avatar_url"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("idx_users_firebase_uid").on(t.firebaseUid)],
)
