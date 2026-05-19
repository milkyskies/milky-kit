# Zig Style & Conventions

## Module layout
- One concept per file; `root.zig` is the package root, `main.zig` the executable entry
- Import at the top of the file — no deep `@import` calls scattered through the body

## Naming
- Types: `PascalCase` (`GameTime`, `WorldMap`)
- Functions and methods: `camelCase` (`updateFromTick`, `tileCenterPx`)
- Constants and variables: `snake_case` (`ticks_per_minute`, `tile_size`) — Zig does **not** use `SCREAMING_SNAKE_CASE`
- Files: `snake_case.zig`

## Control flow
- Early returns and guard clauses
- Prefer `switch` over `if` / `else if` chains — an exhaustive `switch` over an enum or tagged union turns an unhandled case into a compile error
- Use `try` for error propagation; never `catch unreachable` or `orelse unreachable` in production code — handle the error or the null
- `defer` / `errdefer` for cleanup, written right next to the acquisition

## Types
- Distinct types for domain IDs — a single-field struct or a distinct enum, not a bare `u32` that everything can mix up
- Tagged unions over stringly-typed fields — make invalid states unrepresentable
- Handle `?T` optionals explicitly with `if (x) |v|` or `orelse` — never a blind `.?`
- Prefer slices (`[]const T`) over pointers when ownership is not transferred

## Functions
- Keep short — one level of abstraction per function
- Take `[]const T` over `[]T` when the function does not mutate the argument
- Accept an `Allocator` parameter rather than reaching for a global — the caller owns the allocation strategy

## Memory
- Whoever allocates, frees — document ownership when a function returns allocated memory
- Pair every `alloc` with a `defer free`, or `errdefer free` when the allocation escapes on success
- Any test that allocates uses `std.testing.allocator` — it fails the test on a leak, double-free, or bad free, so write a test for anything that allocates just to run it over that path
- The executable's top-level allocator is a `GeneralPurposeAllocator` with a `deinit` leak check in debug builds

## Comptime
- Reach for `comptime` when it removes a runtime cost or makes an invalid state uncompilable — not as a default

## Imports
- Order: `std` -> external packages -> local (`@import("...zig")`)
- Explicit imports at the top of the file

## Error handling
- Define error sets for the failure modes a module actually has; let Zig infer the union where it can
- `try` to propagate, `catch` only where you genuinely handle or translate the error

## Local build config
- Do NOT commit machine-specific build config — keep linker, cache-dir, and target-dir tweaks in your own environment, not in `build.zig` or a committed config file
