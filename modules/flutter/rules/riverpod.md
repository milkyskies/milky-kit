# Riverpod paradigm

This rule is the paradigm core plus the clean-architecture layout for every Flutter project in the kit. It plays the role `modules/effect/rules/effect.md` plays for TypeScript: it decides how effects, errors, dependency injection, and layering work. Compose it with `modules/dart/rules/dart-style.md` (which it does not supersede — the typing and pattern-matching rules hold everywhere).

## The model

Riverpod is two things at once: a dependency-injection container and a cache for asynchronous state. Both roles matter and both replace something you would otherwise hand-roll.

- **`Provider`** — a synchronous value or service. This is dependency injection.
- **`FutureProvider` / `StreamProvider`** — asynchronous read-only state. Exposed to widgets as `AsyncValue<T>`.
- **`NotifierProvider` / `AsyncNotifierProvider`** — state a user can act on. The notifier owns the mutations.

Prefer the code-generated form (`@riverpod` with `riverpod_generator`) over hand-written provider declarations. It gives correct typing on families, removes the provider-type guessing game, and makes `ref.invalidate` refactor-safe.

`AsyncValue<T>` is itself a sealed union of `AsyncData` / `AsyncLoading` / `AsyncError`. Pattern-match it exhaustively; do not use `.when(...)` with a catch-all, and do not reach for `.value!`.

```dart
return switch (ref.watch(activeBalloonsProvider)) {
  AsyncData(:final value) => BalloonList(balloons: value),
  AsyncError(:final error) => ErrorView(error: error),
  AsyncLoading() => const LoadingView(),
};
```

## Where things live

```
lib/
├── core/                             Pure. No Flutter, no I/O, no Riverpod.
│   ├── models/<resource>.dart        Domain model (see modules/dart/rules/models.md).
│   └── services/<concept>.dart       Multi-entity pure algorithms. Plain functions or plain classes.
├── data/
│   ├── generated/                    Generated API client + wire DTOs. Never imported outside data/.
│   ├── mappers/                      Wire ↔ domain conversion.
│   └── repositories/<resource>_repository.dart   Talks to the outside. Returns domain types.
├── features/<feature>/
│   ├── providers/                    Riverpod providers for this feature.
│   └── widgets/                      Widgets for this feature.
├── routing/                          Router configuration and redirects.
└── theme/                            Theme, tokens, extensions.
```

- `core/` imports nothing from `data/`, `features/`, or `routing/`. **It must not import `package:flutter` or `package:riverpod` at all.** This is the load-bearing constraint: it keeps the domain testable with `dart test` (no widget binding, no framework) and it makes the boundary mechanical rather than a matter of discipline.
- `data/repositories/` returns domain types, never generated DTOs.
- `features/` is the only place widgets live. A widget never calls a repository directly — it watches a provider.

Tests live under `test/`, mirroring `lib/` — never colocated inside `lib/`. See the Test layout section of `modules/dart/rules/dart-style.md` for why; the short version is that Dart's runner does not discover colocated tests at all, so they silently never run.

## Keep logic out of widgets

**The equivalent of "use cases are mandatory": any decision, transformation, or invariant lives in `core/` as a plain function, and the widget calls it.**

- A `build` method contains layout and `ref.watch` calls. Not business rules.
- If a widget needs to decide something, that decision is a named function in `core/` with its own test. The widget calls it and renders the result.
- A provider that does more than "fetch this and map it" is doing orchestration; extract the rule into `core/` and have the provider call it.
- The exception is genuinely presentational branching (is this list empty, is this the selected tab). Anything with a domain rule in it moves.

A `build` method with an `if`/`else` ladder over domain state is a code smell. Extract it into a `switch` expression in `core/` that returns a value the widget renders.

## Errors

**The base rules live in `modules/dart/rules/dart-style.md`** — the `Error`-versus-`Exception` distinction, the two-tier split (unexpected failures throw; expected outcomes are named sealed unions in the return type), the catching discipline, and the scoping of `fpdart` to `TaskEither`/`Either` but never `Option`. They apply here unchanged. This section covers only how those tiers surface through Riverpod.

**Unexpected failures ride the `AsyncValue.error` channel.** A provider that throws is not a bug in the provider — it is the mechanism. Riverpod captures the error and the stack trace, and the widget renders it:

```dart
return switch (ref.watch(activeBalloonsProvider)) {
  AsyncData(:final value) => BalloonList(balloons: value),
  AsyncError(:final error) => ErrorView(error: error),
  AsyncLoading() => const LoadingView(),
};
```

- **Do not catch inside a provider just to return a sentinel.** Returning `null`, `[]`, or a default on failure destroys the distinction between "loaded, and empty" and "failed to load", and the UI can no longer offer a retry.
- One shared error widget handles the unexpected tier. Per-screen error rendering is for cases where the screen can genuinely offer something better than "something went wrong, retry".
- Errors reaching this channel are reported to crash tracking. `AsyncValue.error` carries the stack trace — pass it through rather than logging `error.toString()` alone.

**Expected outcomes do not use the error channel.** A join request being rejected, a balloon being full, a validation rule failing — these are *successful* operations whose result happens to be a refusal. They come back as `AsyncData` holding a sealed union, and the widget pattern-matches on it. Putting a domain outcome into `AsyncError` means the shared error widget swallows something the user needed to read.

**Mutations report failure to the caller, not the console.** A notifier method that fails should surface it — as a returned sealed union the caller matches on, or by letting it throw so the calling widget can catch it and show a message. A mutation that logs and returns silently leaves the user staring at an unchanged screen.

Never swallow an error. If you cannot act on a failure, let it reach a boundary that can.

## Mutations and optimistic updates

Riverpod has no mutation primitive. There is no `useMutation`, no built-in optimistic update, no rollback. You build it — which means you build it **once**, not per call site.

- **Write a single shared helper for optimistic mutations.** Rollback lives inside the helper, not in each caller's error handler. A caller that forgets to restore is a silent data-loss bug, and the only reliable defence is making it impossible to forget.
- **Anything changed before the request settles must be restorable.** Capture the prior value first, restore it on failure. This covers local UI state exactly as much as cache writes: **a cleared text field is optimistic state**, and it is the one people forget, because it does not look like a cache.
- **Restoring must not clobber newer state.** If a second mutation started after the first, rolling back to the first's snapshot discards the second's work. Either serialise mutations on the same key, or verify the state has not moved before restoring.
- **On success, replace the optimistic value with the server's.** Invalidate and refetch rather than leaving the guess in place. The guess and the truth drift — server-assigned identifiers, timestamps, computed fields — and a stale guess that looks correct is worse than a brief loading state.
- **An optimistic update is a lie you are choosing to tell.** Only tell it where the operation almost always succeeds and the latency is genuinely user-visible. For a rare, slow, or destructive operation, a pending indicator is honest, simpler, and has no rollback to get wrong.

## Dependency injection via providers

- **Every service, repository, and client is a provider.** Not a singleton, not a global, not a constructor parameter threaded through widgets.
- Business code reaches dependencies via `ref.watch` / `ref.read`, so tests swap them with `overrideWith` and nothing else changes.
- External clients (HTTP, Firebase, storage, third-party SDKs) each get their own provider built from configuration. This is what makes them stubbable.

```dart
@riverpod
BalloonRepository balloonRepository(Ref ref) =>
    BalloonRepository(client: ref.watch(apiClientProvider));
```

- `ref.watch` in a provider body when you want to rebuild on change. `ref.read` only inside callbacks and event handlers, never in a build or provider body.

## Configuration

- All runtime configuration comes from a single typed configuration object exposed as a provider, built from `--dart-define` values at startup.
- Never read `Platform.environment` or a bare `String.fromEnvironment` in business logic. Read it once, at the edge, into the configuration object.
- Secrets never live in committed files and never in `dart-define` defaults.

## Resources and lifecycle

- Anything with acquire/release uses `ref.onDispose`. Never a bare `finally` for lifetime management.
- Providers auto-dispose by default with code generation. Opt out deliberately with `ref.keepAlive()` and say why — an always-alive provider is a leak unless it is genuinely app-scoped.
- Subscriptions (streams, listeners, controllers) are cancelled in `onDispose` or the widget's `dispose`.

## Concurrency

- `Future.wait` with an explicit list for independent calls. Never fire a batch of futures and await them one at a time in a loop.
- Guard against out-of-order responses in notifiers: if a newer request has started, discard the older result rather than writing stale state.

## Retries and scheduling

- Wrap flaky external calls in explicit retry with backoff. Do not hand-roll a retry loop with `Future.delayed` scattered across call sites — put it in the client or an interceptor once.
- Polling belongs in the provider that owns the data, driven by a timer or `Stream.periodic`, cancelled in `onDispose`.

## Logging and tracing

- Structured logging through one logger provider. No bare `print` outside of throwaway debugging.
- Errors reaching a boundary are reported to crash tracking with enough context to identify the user action, not just the stack.

## Testing

The three-tier model lives in `modules/core/rules/testing.md`. This section is the Flutter-flavoured tool layer.

- **Domain tier** — pure functions in `core/`, tested with `dart test`. No Flutter binding, no `ProviderContainer`, no mocks beyond hand-written fakes. These run in milliseconds and should be the bulk of the suite. Required for every non-trivial function in `core/`.
- **Provider tier** — build a `ProviderContainer` with `overrides: [repositoryProvider.overrideWith(...)]`, then read the provider and assert. Use this for orchestration logic that genuinely lives in a notifier.
- **Widget tier** — `testWidgets` with a `ProviderScope` wrapping the subject and the same overrides. Deliberately few: cover wiring, not rules, because the rules were already covered at the domain tier.
- **Mocking** uses `mocktail` (no code generation, works with null safety). Prefer a hand-written fake over a mock when the interface is small.
- Time-dependent logic takes a clock. Never `Future.delayed` in a test to wait for something.
- **Scenario codes in test names** when a `docs/test/<feature>.md` spec exists: `test('MAP-001 snaps to the nearest public landmark', ...)`. Grep finds the test from the spec and the spec from the test.

## If you do not know how to express something

Look it up before improvising — the Riverpod docs at riverpod.dev, the Dart language tour for patterns, or the package's source. Do not silently fall back to a global singleton, a `StatefulWidget` holding business state, or `setState` for something that belongs in a provider. A short pause to find the right shape is cheaper than a refactor later.
