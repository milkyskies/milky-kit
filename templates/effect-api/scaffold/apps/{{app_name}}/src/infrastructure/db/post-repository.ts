import { SqlClient } from "@effect/sql"
import { PgDrizzle } from "@effect/sql-drizzle/Pg"
import { eq } from "drizzle-orm"
import { Effect, Layer, Option } from "effect"
import { Post } from "@/domain/models/post"
import {
	DbError,
	type NewPost,
	PostNotFound,
	type PostPatch,
	PostRepository,
} from "@/domain/repositories/post-repository"
import { type PostRow, postsTable } from "@/infrastructure/db/schema"

const fromRow = (row: PostRow): Post =>
	new Post({
		id: row.id,
		title: row.title,
		body: row.body,
		publishedAt: Option.fromNullable(row.publishedAt),
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	})

const wrapDbError = <A, R>(eff: Effect.Effect<A, unknown, R>): Effect.Effect<A, DbError, R> =>
	eff.pipe(Effect.mapError((cause) => new DbError({ cause })))

export const PostRepositoryLive = Layer.effect(
	PostRepository,
	Effect.gen(function* () {
		const db = yield* PgDrizzle
		const sql = yield* SqlClient.SqlClient

		const findAll = () =>
			wrapDbError(db.select().from(postsTable)).pipe(Effect.map((rows) => rows.map(fromRow)))

		const findById = (id: string) =>
			wrapDbError(db.select().from(postsTable).where(eq(postsTable.id, id))).pipe(
				Effect.map((rows) => Option.fromNullable(rows[0]).pipe(Option.map(fromRow))),
			)

		const create = (input: NewPost) =>
			wrapDbError(
				db
					.insert(postsTable)
					.values({
						id: input.id,
						title: input.title,
						body: input.body,
						publishedAt: Option.getOrNull(input.publishedAt),
					})
					.returning(),
			).pipe(
				Effect.flatMap((rows) => {
					const row = rows[0]
					return row
						? Effect.succeed(fromRow(row))
						: Effect.fail(new DbError({ cause: "insert returned no rows" }))
				}),
			)

		const update = (id: string, patch: PostPatch) =>
			sql
				.withTransaction(
					Effect.gen(function* () {
						const existing = yield* findById(id)
						const post = yield* Option.match(existing, {
							onNone: () => Effect.fail(new PostNotFound({ id })),
							onSome: (p) => Effect.succeed(p),
						})

						const updated = yield* wrapDbError(
							db
								.update(postsTable)
								.set({
									title: Option.getOrUndefined(patch.title) ?? post.title,
									body: Option.getOrUndefined(patch.body) ?? post.body,
									updatedAt: new Date(),
								})
								.where(eq(postsTable.id, id))
								.returning(),
						)

						const row = updated[0]
						return row ? fromRow(row) : post
					}),
				)
				.pipe(Effect.catchTag("SqlError", (cause) => Effect.fail(new DbError({ cause }))))

		const del = (id: string) =>
			wrapDbError(db.delete(postsTable).where(eq(postsTable.id, id)).returning()).pipe(
				Effect.flatMap((rows) =>
					rows.length === 0 ? Effect.fail(new PostNotFound({ id })) : Effect.void,
				),
			)

		return PostRepository.of({
			findAll,
			findById,
			create,
			update,
			delete: del,
		})
	}),
)
