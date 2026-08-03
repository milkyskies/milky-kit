---
paths:
  - "**/*.dart"
  - "pubspec.yaml"
---

# Dart conventions

Paradigm-neutral rules that apply to every Dart file. Projects using Riverpod additionally follow `modules/flutter/rules/riverpod.md`, which supersedes the dependency-injection and error-handling choices below with Riverpod equivalents.

These rules assume Dart 3. Sealed classes, pattern matching, records, and switch expressions are the load-bearing features; most of what follows is about using them instead of the pre-Dart-3 shapes.

## Analyzer baseline

Every project enables strict analysis in `analysis_options.yaml`:

```yaml
analyzer:
  language:
    strict-casts: true
    strict-inference: true
    strict-raw-types: true
  errors:
    invalid_use_of_visible_for_testing_member: error
```

Turning these off is never the fix. If the analyzer complains, the types are wrong upstream.

## Strong typing

- **Never use `!` (the bang / null-assertion operator).** Handle the absent case explicitly with a pattern. `!` is the exact equivalent of TypeScript's non-null assertion and is banned for the same reason: it converts a type error into a runtime crash.
- **Never use `as` casts** except at trusted system boundaries (decoding JSON, reading platform channels). If you reach for `as`, narrow with a pattern instead: `if (value case final String name)` both tests and binds in one step.
- **Never use `dynamic`.** Use `Object?` and narrow with patterns. `dynamic` disables the analyzer entirely on that expression, which is strictly worse than `Object?`.
- Prefer narrowing via patterns (`case final String s`, `case Balloon(:final air)`) over `is` checks followed by a cast.

## Optionals

- **Use `T?` for absent values. Do not introduce an `Option` type.** Dart's null safety is sound (the compiler proves non-nullness rather than trusting an annotation), and `T?` is what every SDK and package returns. Adding a second representation of absence means converting at every boundary in both directions.
- **Handle absence with a pattern, not a bang.** A switch over a nullable is exhaustiveness-checked, because Dart treats `T?` as a union of `T` and `Null`:

  ```dart
  switch (balloon.snapPoiId) {
    case final poiId?:
      groupByLandmark(poiId);
    case null:
      renderLoose(balloon);
  }
  ```

  This gives the same "every case handled" guarantee a wrapper type would, with no wrapper.

- `??`, `?.`, `??=`, `...?`, and `?..` are all fine. They are operators, not branches, and they read left to right.
- **Field promotion is limited: only private final fields promote.** A public field, a non-final field, or a getter will not narrow from a null check, so `if (widget.name != null) widget.name.length` does not compile. Bind through a pattern (`if (widget.name case final name?)`) rather than copying to a local.
- The one case that justifies a wrapper is **nested absence**. `T??` collapses to `T?`, so if you genuinely need to distinguish "no entry" from "an entry holding null" (generic caches, map lookups), model that case explicitly rather than pretending `T?` covers it.

## Pattern matching

- **Prefer `switch` expressions over `if`/`else` chains.** A switch expression that does not cover every case is a compile error, which is a stronger guarantee than any library-level exhaustiveness helper.

  ```dart
  String messageFor(LocationStatus status) => switch (status) {
    LocationStatus.denied => '現在地がオフです',
    LocationStatus.loading ||
    LocationStatus.unavailable ||
    LocationStatus.granted => '現在地を取得できません',
  };
  ```

- **Do not use a bare `_` wildcard where exhaustiveness matters.** A `_` case silently swallows every variant added later, which is exactly the drift that exhaustiveness checking exists to prevent. Enumerate the cases and group them with `||` patterns instead. Reserve `_` for positions inside a pattern that are genuinely irrelevant, such as the second field of a record you are not branching on.
- **Switch on a record when a decision depends on more than one input.** The result is a decision table the compiler verifies:

  ```dart
  bool canLaunchBalloon(LocationStatus status, {required bool isFarMode}) =>
      switch ((status, isFarMode)) {
        (LocationStatus.granted, false) => true,
        (LocationStatus.granted, true) => false,
        (LocationStatus.loading, _) => false,
        (LocationStatus.denied, _) => false,
        (LocationStatus.unavailable, _) => false,
      };
  ```

- Use a `when` guard for value predicates that patterns cannot express: `case final air when air <= 0 => baseSize`.
- Destructure in the pattern rather than in the body: `case LocationDenied(:final canAskAgain)`.
- `if` remains correct for **early-return guard clauses**. Avoid `else` — invert the condition and return.

## Sums

- **Use `enum` for a closed set of cases that carry no data.** Dart enums are exhaustively checked in a switch, so the TypeScript rule banning enums does not transfer — that ban exists because TypeScript's enums are unsound, and Dart's are not.
- **Use `sealed class` when cases carry differing data.** Mark variants `final class` so the hierarchy stays closed and exhaustiveness holds.

  ```dart
  sealed class LocationOutcome {
    const LocationOutcome();
  }

  final class LocationGranted extends LocationOutcome {
    const LocationGranted(this.coords);
    final Coords coords;
  }

  final class LocationDenied extends LocationOutcome {
    const LocationDenied({required this.canAskAgain});
    final bool canAskAgain;
  }

  final class LocationUnavailable extends LocationOutcome {
    const LocationUnavailable();
  }
  ```

- Reach for `freezed` when you want the equality, `copyWith`, and JSON plumbing generated rather than hand-written. Freezed 3 emits native sealed classes, so pattern matching works the same either way — prefer native `switch` over any generated `when`/`map` helpers.

## Errors

Dart has no typed error channel — there is no `E` in the return type the way `Effect<A, E, R>` gives you. The discipline has to come from convention, and the convention is: **decide whether a failure is expected, and let that decide the mechanism.**

### `Error` vs `Exception`

Dart's own hierarchy already encodes the distinction. Respect it.

- **`Error` and its subclasses signal a programming bug** (`StateError`, `ArgumentError`, `TypeError`, `UnimplementedError`). Throwing one asserts "this cannot happen". **Do not catch them** — a caught `Error` is a bug you have hidden rather than fixed. This is Dart's equivalent of an Effect defect.
- **`Exception` signals a condition the program should anticipate** — I/O failure, a timeout, malformed input from outside the system.
- **Never throw a bare `String`, `int`, or arbitrary object.** Dart permits it, and it destroys the ability to catch selectively downstream.

### Two tiers

| Kind | Mechanism | Handled |
|---|---|---|
| **Unexpected** — the network is down, the server returned 500, a payload failed to parse, a bug | `throw` | At an outer boundary that can report or retry. Not at the call site. |
| **Expected** — a domain outcome the caller must reckon with | **named sealed union in the return type** | Pattern-matched exhaustively at the call site |

This is the same split as Effect's defect-versus-`Data.TaggedError` distinction, expressed in Dart's idiom rather than fighting it.

For expected outcomes, prefer a **per-operation named sealed union** over a generic `Result<T, E>`:

```dart
sealed class SubmitOrderOutcome {
  const SubmitOrderOutcome();
}

final class OrderAccepted extends SubmitOrderOutcome {
  const OrderAccepted(this.orderId);
  final String orderId;
}

final class PaymentDeclined extends SubmitOrderOutcome {
  const PaymentDeclined({required this.reason});
  final String reason;
}

final class OutOfStock extends SubmitOrderOutcome {
  const OutOfStock(this.availableQuantity);
  final int availableQuantity;
}
```

Named cases read better than `Left(SomeEnum.paymentDeclined)`, exhaustiveness checking works identically, and it scales past two outcomes without nesting generics. A caller cannot forget to handle `OutOfStock`, because the switch will not compile.

### Catching

- **Always type the catch and always take the stack trace**: `on FormatException catch (error, stackTrace)`. A bare `catch (error)` swallows `Error` subclasses too, which is how a genuine bug becomes a silent wrong answer.
- **Never write an empty catch block.** `catch (_) {}` is banned outright. If a failure genuinely does not matter, say why in a comment and log it.
- **Use `rethrow`, not `throw error`.** `throw error` resets the stack trace to the rethrow point and loses the original origin.
- When wrapping an exception in a more meaningful one, preserve the original trace with `Error.throwWithStackTrace(newError, stackTrace)` rather than throwing fresh.
- **Do not catch what you cannot handle.** Converting an exception into a `null` return, an empty list, or a default value is almost always wrong — it moves the failure to a place with less context, where it presents as bad data instead of an error.

### fpdart

`fpdart` is **permitted but scoped**.

- **Use `TaskEither` / `Either`** where you are genuinely chaining several fallible asynchronous steps and the alternative is nested try/catch with intermediate nullable locals. Short-circuiting a three-step pipeline is where it earns its cost.
- **Do not use fpdart's `Option`.** See the Optionals section above: `T?` with pattern matching already gives exhaustive absence handling, every SDK in the ecosystem returns `T?`, and a second representation of absence means converting in both directions at every boundary.
- **Do not mix idioms within a layer.** A function returns a sealed union *or* a `TaskEither`, not both patterns scattered through the same module. Pick per layer and stay consistent, so callers know what shape to expect.
- Be aware there is no do-notation at the language level. `TaskEither.Do` works but is noisier than `Effect.gen`, and inference through it is weaker. If a chain is getting hard to read, that is usually the signal to go back to a sealed union and an ordinary `await`.

## Test layout

**Tests live under `test/`, mirroring the `lib/` structure.** `lib/src/map/poi_grouping.dart` is tested by `test/map/poi_grouping_test.dart`.

**Do not colocate test files inside `lib/`.** This is a habit worth unlearning if you come from TypeScript, where colocation is standard. In Dart it breaks two things:

- **The test runner only discovers `test/**_test.dart`.** A colocated test is silently never executed by a bare `dart test` — it passes review, it looks like coverage, and it never runs. Nothing warns you.
- **`lib/` is the package's public surface** and must not import dev dependencies. A test file under `lib/` importing `package:test` trips `depend_on_referenced_packages`, correctly.

Tests import the code under test through a package import (`package:my_package/src/map/poi_grouping.dart`), not a relative path that reaches back into `lib/`.

Every package has a public entry point at `lib/<package_name>.dart` that re-exports its public API from `lib/src/`. Everything under `src/` is private by convention; consumers import the barrel, never a `src/` path.

## Naming

- Files are `snake_case.dart`. Types are `UpperCamelCase`. Members and locals are `lowerCamelCase`. Constants are `lowerCamelCase`, not `SCREAMING_CASE`.
- No single-letter variables except in short lambdas where context is obvious.
- No abbreviations. Write `configuration`, not `cfg`; `repository`, not `repo`.
- A leading `_` marks library-private. Use it for anything not part of the public surface — it is also what makes field promotion work.

## Immutability

- Prefer `final` for every field and local. Use `const` constructors wherever the value is compile-time constant.
- Domain types are immutable. Construct once, derive with `copyWith`, never mutate in place.
- Return `List<T>`/`Map<K, V>` from domain code as unmodifiable views (or rely on freezed, which handles this) so callers cannot mutate shared state.

## Dates

- Use `package:intl` for formatting and locale-aware display.
- Domain logic that depends on the current time takes a clock rather than calling `DateTime.now()` directly, so behaviour is deterministic under test.
- Store and pass `DateTime` in UTC; convert to local only at the display boundary.

## Async

- `Future<T>` for a single asynchronous value, `Stream<T>` for many. Do not hand-roll callback APIs.
- Never leave a `Future` unawaited by accident. If ignoring the result is deliberate, say so with `unawaited(...)` from `dart:async`.
- Prefer `Future.wait` with an explicit list over sequential awaits when the calls are independent.
- Anything with acquire/release ownership is released in `dispose`/`onDispose`, never in an ad-hoc `finally`.
