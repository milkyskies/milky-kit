import { desc, eq } from "drizzle-orm"
import { makeWithDefaults } from "drizzle-orm/effect-postgres"
import { Effect, Layer, Option } from "effect"
import { Post } from "../../domain/models/post"
import { PostNotFound } from "../../domain/models/post-not-found"
import {
	DbError,
	type NewPost,
	type PostPatch,
	PostRepository,
} from "../../domain/repositories/post-repository"
import { type PostRow, postsTable } from "./schema"

const fromRow = (row: PostRow): Post =>
	new Post({
		id: row.id,
		title: row.title,
		body: row.body,
		publishedAt: Option.fromNullishOr(row.publishedAt),
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	})

const wrapDbError = <A, R>(effect: Effect.Effect<A, unknown, R>): Effect.Effect<A, DbError, R> =>
	effect.pipe(Effect.mapError((cause) => new DbError({ cause })))

export const PostRepositoryLive = Layer.effect(
	PostRepository,
	Effect.gen(function* () {
		const db = yield* makeWithDefaults()

		const findAll = () =>
			wrapDbError(db.select().from(postsTable).orderBy(desc(postsTable.createdAt))).pipe(
				Effect.map((rows) => rows.map(fromRow)),
			)

		const findById = (id: string) =>
			wrapDbError(db.select().from(postsTable).where(eq(postsTable.id, id))).pipe(
				Effect.map((rows) => Option.fromNullishOr(rows[0]).pipe(Option.map(fromRow))),
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

					if (!row) return Effect.fail(new DbError({ cause: "insert returned no rows" }))

					return Effect.succeed(fromRow(row))
				}),
			)

		const update = (id: string, patch: PostPatch) =>
			wrapDbError(
				db
					.update(postsTable)
					.set({
						...Option.match(patch.title, {
							onNone: () => ({}),
							onSome: (title) => ({ title }),
						}),
						...Option.match(patch.body, {
							onNone: () => ({}),
							onSome: (body) => ({ body }),
						}),
						updatedAt: new Date(),
					})
					.where(eq(postsTable.id, id))
					.returning(),
			).pipe(
				Effect.flatMap((rows) => {
					const row = rows[0]

					if (!row) return Effect.fail(new PostNotFound({ id }))

					return Effect.succeed(fromRow(row))
				}),
			)

		const del = (id: string) =>
			wrapDbError(db.delete(postsTable).where(eq(postsTable.id, id)).returning()).pipe(
				Effect.flatMap((rows) =>
					rows.length === 0 ? Effect.fail(new PostNotFound({ id })) : Effect.void,
				),
			)

		return PostRepository.of({ findAll, findById, create, update, delete: del })
	}),
)
