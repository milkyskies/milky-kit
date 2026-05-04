# Firebase Auth Setup (backend)

The `auth=firebase` variant scaffolds a complete two-step auth flow:

1. **`authMiddleware`** verifies the Firebase ID token and exposes its claims (`firebaseUid`, `firebaseEmail`, `firebaseName`, `firebasePicture`) on context. Use this on routes that need to know WHO the request comes from but don't require a profile yet — e.g. signup.
2. **`requireUserMiddleware`** runs AFTER auth, looks up the internal user row (KV-cached, 5-min TTL), sets `userId` on context, returns 409 `ProfileRequired` if no profile exists. Use this on every "real" route after signup.

## What scaffolded

- `presentation/middleware/auth.ts` — Firebase token verifier (no DB lookup)
- `presentation/middleware/require-user.ts` — internal-user resolver with KV cache
- `application/use-case/find-user-by-firebase-uid.ts` — pure query
- `application/use-case/create-user-from-firebase.ts` — throws `UserAlreadyExists` if profile exists
- `application/errors.ts` — `UserNotFound`, `UserAlreadyExists` tagged errors *(in base scaffold; auth only references)*
- `presentation/error-handler.ts` — maps tagged errors to HTTP statuses *(base)*
- `presentation/dto/me-dto.ts` — `MeDto` + `createMeSchema` (zod)
- `presentation/routes/me-routes.ts` — `GET /me` (404 ProfileRequired) + `POST /me` (signup, 409 if exists)
- `infrastructure/env-auth.ts` — `FIREBASE_PROJECT_ID` + `JWK_CACHE` + `USER_CACHE` bindings
- `package.json` — `firebase-auth-cloudflare-workers`, `@hono/zod-validator`, `zod`
- `wrangler.jsonc` — `vars.FIREBASE_PROJECT_ID` + 2 KV namespaces

## Manual setup

### 1. Create the Firebase project

https://console.firebase.google.com → "Add project". Enable a sign-in method (Authentication → Sign-in method → Email/Password). Copy the project id.

### 2. Fill in FIREBASE_PROJECT_ID

Edit `apps/{{app_name}}/wrangler.jsonc` — replace `<your-firebase-project-id>` in `vars.FIREBASE_PROJECT_ID`.

### 3. Create the KV namespaces

```bash
cd apps/{{app_name}}
pnpm wrangler kv namespace create JWK_CACHE
pnpm wrangler kv namespace create USER_CACHE
```

Paste returned `id`s into `wrangler.jsonc` under the matching bindings.

### 4. Wire the routes into app.ts

The variant doesn't overlay `app.ts` (your api_style variant owns that file). Add the imports + route mount manually. Example for `api_style = "rpc"`:

```ts
// apps/{{app_name}}/src/presentation/app.ts
import { Hono } from "hono";
import type { Bindings } from "../infrastructure/env";
import { corsMiddleware } from "./middleware/cors";
import { repositoriesMiddleware, type RepositoryVariables } from "./middleware/repositories";
import { type AuthVariables } from "./middleware/auth";
import { requireUserMiddleware, type RequireUserVariables } from "./middleware/require-user";
import { errorHandler } from "./error-handler";
import { meRoutes } from "./routes/me-routes";
import { postRoutes } from "./routes/post-routes";

export const app = new Hono<{
  Bindings: Bindings;
  Variables: RepositoryVariables & AuthVariables & RequireUserVariables;
}>()
  .use("*", corsMiddleware)
  .use("*", repositoriesMiddleware)
  .onError(errorHandler)
  .route("/", meRoutes)             // GET /me + POST /me — auth-only, no profile required
  .use("/api/*", requireUserMiddleware)  // gate everything below
  .route("/", postRoutes);
```

Inside protected handlers, `context.var.userId` is the internal user id (always present below the `requireUserMiddleware` gate). Inside `meRoutes`, `context.var.firebaseUid` etc. are available but `userId` may not exist yet.

### 5. Generate + apply migrations

```bash
pnpm db:generate
pnpm db:migrate    # or db:migrate:local for D1
```

### 6. Client-side wiring

If you're using `auth=firebase` on react too, see `apps/<client>/SETUP-AUTH.md`.

## Optional: Firebase Auth Emulator

```bash
firebase emulators:start --only auth
```

Then in `.dev.vars`:

```
FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099"
```

The middleware reads this and routes verification through the emulator.
