import { zValidator } from "@hono/zod-validator"
import { Option } from "effect"
import { Hono } from "hono"
import { createUserFromFirebase } from "../../application/use-case/create-user-from-firebase"
import { findUserByFirebaseUid } from "../../application/use-case/find-user-by-firebase-uid"
import type { Bindings } from "../../infrastructure/env"
import { createMeSchema, toMeDto } from "../dto/me-dto"
import { type AuthVariables, authMiddleware } from "../middleware/auth"
import type { RepositoryVariables } from "../middleware/repositories"

type Variables = RepositoryVariables & AuthVariables

export const meRoutes = new Hono<{
	Bindings: Bindings
	Variables: Variables
}>()
	.use("/me", authMiddleware)
	.get("/me", async (context) => {
		const user = await findUserByFirebaseUid(context.var.userRepository, context.var.firebaseUid)

		return Option.match(user, {
			onNone: () => context.json({ error: "ProfileRequired" }, 404),
			onSome: (value) => context.json(toMeDto(value)),
		})
	})
	.post("/me", zValidator("json", createMeSchema), async (context) => {
		const body = context.req.valid("json")
		const user = await createUserFromFirebase(context.var.userRepository, {
			firebaseUid: context.var.firebaseUid,
			email: context.var.firebaseEmail,
			displayName: body.displayName,
			avatarUrl: context.var.firebasePicture,
		})

		return context.json(toMeDto(user), 201)
	})
