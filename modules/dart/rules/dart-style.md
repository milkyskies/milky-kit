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
