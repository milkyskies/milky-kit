# Flutter conventions

Widget, theming, and navigation conventions. Composes with `modules/dart/rules/dart-style.md` (typing and pattern matching) and `modules/flutter/rules/riverpod.md` (state, dependency injection, layering).

## Widgets

- **Prefer `StatelessWidget`, or `ConsumerWidget` when the widget reads providers.** Reach for `StatefulWidget` / `ConsumerStatefulWidget` only when you genuinely own a controller, an animation, or a focus node that needs a lifecycle.
- **Always give widgets a `const` constructor** where the fields allow it, and construct with `const` at the call site. This is the single highest-leverage performance habit in Flutter — a `const` widget is skipped entirely on rebuild.
- **Extract widgets into named classes, not `_buildSomething()` methods.** A helper method rebuilds with its parent; a separate widget class does not, and it can be `const`. Private methods returning `Widget` are a smell.
- **Never put business logic in `build`.** See the "Keep logic out of widgets" section of the Riverpod rule.
- **`build` must be pure and cheap.** No I/O, no `ref.read` side effects, no allocation of controllers, no `DateTime.now()`.
- Prefer composition over deeply parameterised widgets. Two focused widgets beat one with eight optional flags.
- Shared widgets live in a shared directory; feature-scoped widgets live under their feature. Default to feature-scoped and promote when a second caller appears.

## Layout

- Use `const` `EdgeInsets` and spacing values from the theme, not scattered magic numbers.
- Prefer `Column`/`Row` + `Expanded`/`Flexible` over `Stack` with manual offsets, unless you are genuinely overlaying.
- Long or unbounded lists use `ListView.builder` / `SliverList`, never a `Column` inside a `SingleChildScrollView`.
- Respect safe areas with `SafeArea` or `MediaQuery.paddingOf(context)`. Never hardcode notch or home-indicator heights.
- Use `MediaQuery.sizeOf(context)` / `.paddingOf(context)` rather than `MediaQuery.of(context)`, so the widget only rebuilds on the property it actually depends on.

## Theming

- **All colours, spacing, radii, and typography come from the theme.** No literal `Color(0xFF...)` in a widget file.
- Project-specific tokens go in a `ThemeExtension` so they are typed and accessible via `Theme.of(context).extension<AppColors>()`.
- Light and dark are both defined. A widget never branches on brightness itself — it reads a token that already differs per theme.
- Text styles come from `Theme.of(context).textTheme` or a project extension, never constructed inline.

## Navigation

- **`go_router`** for routing. Routes are declared in one place under `routing/`.
- **Auth and onboarding gating belongs in `redirect`**, not in widget-level conditional rendering. A redirect is evaluated before the route builds, so the gated screen never flashes.
- Prefer typed routes (`go_router_builder`) so route parameters are checked at compile time rather than parsed from strings at runtime.
- Deep links are part of the router configuration, not an ad-hoc listener bolted on elsewhere.

## Sheets and dialogs

- Use `showModalBottomSheet` for bottom sheets and `showDialog` for dialogs unless the design needs behaviour they cannot express, in which case reach for a maintained package rather than hand-rolling gesture handling.
- Always pass `isScrollControlled: true` for sheets containing scrollable or keyboard-adjacent content, and wrap the content in `SafeArea`.
- A sheet returns its result through `Navigator.pop(context, value)` and the caller awaits it. Do not have a sheet write to a provider as its only way of communicating a result — that hides the data flow.
- Dismissal is always possible unless the flow is genuinely blocking.

## Forms and input

- Use `TextEditingController` owned by a `StatefulWidget` and disposed in `dispose`. Never let one leak.
- Validation rules are pure functions in `core/`, called by the form. The form renders the result; it does not contain the rule.
- Flutter handles keyboard insets natively via `Scaffold.resizeToAvoidBottomInset` and `MediaQuery.viewInsetsOf`. Do not port keyboard-avoidance workarounds from other frameworks.

## Assets and icons

- Icons come from the project's icon set (a package or wrapped SVGs), one source, consistently. Never emoji as UI icons.
- SVGs render through `flutter_svg`. Raster assets declare explicit `cacheWidth`/`cacheHeight` when displayed small, so a large source image does not sit decoded at full size in memory.
- Assets are declared in `pubspec.yaml` by directory, not file-by-file.

## Accessibility

- Every interactive element has a semantic label. Icon-only buttons must have one — the icon is not a label.
- Respect the platform text scale. Do not lock `textScaleFactor` to 1.0 to make a layout fit; fix the layout.
- Minimum touch target is 48x48 logical pixels.

## Performance

- `const` constructors everywhere they apply (this is worth repeating).
- Keep `ref.watch` as narrow as possible — watch the derived value, not the whole object, so an unrelated field change does not rebuild the subtree.
- Use `RepaintBoundary` around genuinely expensive, independently-animating subtrees. Not everywhere; it costs memory.
- Do not allocate in `build`: no `List` construction, no closure that could be a top-level function, no controller creation.

## Platform channels and native

- Prefer a maintained package over writing a platform channel. If you must write one, it lives behind a Dart interface exposed as a provider, so the rest of the app is testable without the native side.
- Platform branching (`Platform.isIOS`) belongs in one place near the boundary, not scattered through widgets.
