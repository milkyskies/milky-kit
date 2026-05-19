import { Layer } from "effect"
import { BunRuntime } from "@effect/platform-bun"
import { AppLive } from "./app-live"

/**
 * Single edge call to runMain — the platform runtime handles signals
 * (SIGINT/SIGTERM), the root scope, and graceful shutdown. Every other
 * Effect in the codebase composes into AppLive.
 */
Layer.launch(AppLive).pipe(BunRuntime.runMain)
