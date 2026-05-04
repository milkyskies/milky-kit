# Firebase Auth Setup

The auth=firebase variant scaffolded:
- `presentation/middleware/auth.ts` — verifies Firebase ID tokens, upserts the user
- `domain/models/user.ts`, `domain/repositories/user-repository.ts` — User domain
- `infrastructure/db/user-repository.ts` — repo impl (uses the always-present `usersTable`)
- `application/use-case/find-or-create-user-from-firebase.ts` — first-touch upsert
- `infrastructure/env-auth.ts` — `FIREBASE_PROJECT_ID`, `JWK_CACHE` + `USER_CACHE` KV bindings
- `package.json` — added `firebase-auth-cloudflare-workers`
- `wrangler.jsonc` — added `vars.FIREBASE_PROJECT_ID` + `kv_namespaces` for `JWK_CACHE` and `USER_CACHE`

## Manual setup

### 1. Create the Firebase project

1. https://console.firebase.google.com → "Add project"
2. Enable an auth method (Email/Password, Google, etc.) under Authentication → Sign-in method
3. Copy the project id

### 2. Wire FIREBASE_PROJECT_ID

Edit `apps/{{app_name}}/wrangler.jsonc` — replace `<your-firebase-project-id>` in `vars.FIREBASE_PROJECT_ID`.

### 3. Create the KV namespaces

The Worker uses two KV namespaces:
- `JWK_CACHE` — caches Google's JWKS so Firebase token verification avoids hitting Google's URL on every request.
- `USER_CACHE` — caches `firebaseUid → internal userId` so authed requests skip the DB lookup on warm sessions (5-minute TTL).

```bash
cd apps/{{app_name}}
pnpm wrangler kv namespace create JWK_CACHE
pnpm wrangler kv namespace create USER_CACHE
```

Paste the returned `id`s into `wrangler.jsonc` under the matching bindings.

### 4. Wire the auth middleware into your routes

Open `apps/{{app_name}}/src/presentation/app.ts` and apply `authMiddleware` to the routes that need a signed-in user:

```ts
import { authMiddleware } from "./middleware/auth";

export const app = new Hono<{ Bindings; Variables }>()
  .use("*", repositoriesMiddleware)
  .use("/api/*", authMiddleware)   // <-- add this line
  .route("/", postRoutes);
```

Inside protected handlers, `context.var.userId` is the internal user id.

### 5. Generate + apply migrations (users table)

The `usersTable` ships in your db schema regardless of auth choice. Run a fresh migration:

```bash
pnpm db:generate
pnpm db:migrate    # or db:migrate:local for D1
```

### 6. Sign in from the client

If you're using `auth=firebase` on the React side too, that variant ships the Web SDK setup. See `apps/<client>/SETUP-AUTH.md` for the client-side steps.

## Optional: Firebase Auth Emulator for local dev

To verify ID tokens against the local emulator instead of Google's production JWKS:

```bash
# Run the emulator
firebase emulators:start --only auth
```

Then in `apps/{{app_name}}/.dev.vars`, add:

```
FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099"
```

The middleware reads this and routes verification through the emulator.
