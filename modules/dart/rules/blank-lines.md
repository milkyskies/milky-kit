---
paths:
  - "**/*.dart"
  - "pubspec.yaml"
---

# Blank lines (kaigyou)

Use blank lines to separate the *phases* of a function: setup → validate → work → return. Reading top-to-bottom should feel like reading a paragraph, not a wall of text.

`dart format` does not enforce this — it preserves whatever you write and never inserts or strips blank lines inside a body. So the rule is on you (and on agents writing code in this project).

## Rules

1. **Blank line before `return`** — unless `return` is the entire body.
2. **Blank line before/after every block** (`if`, `for`, `while`, `try`, `switch` statement) — unless the block is the first or last statement of its parent.
3. **Blank line after early-return guards** — `if (id == null) return;` separates "validation" from "real work".
4. **Blank line between groups of single-line statements that do different things** — assignments → side effects → return.
5. **No blank line between consecutive variable declarations** that compute related values — they group as one "declaration block".
6. **No blank line between chained calls / sequential operations** that conceptually do one thing.
7. **Blank line between the `import` block and the first declaration** (this is already standard, and `dart format` will not do it for you).

## Examples

### Bad — wall of code

```dart
Future<Post> createPost(PostRepository repository, CreatePostInput input) async {
  final id = nanoid();
  final now = clock.now();
  if (input.title.trim().isEmpty) throw ArgumentError('title required');
  if (input.title.length > 200) throw ArgumentError('title too long');
  final post = await repository.create(id: id, title: input.title, body: input.body, createdAt: now);
  logger.info('post created', {'id': id});
  if (input.publish) {
    await repository.publish(id);
    logger.info('post published', {'id': id});
  }
  return post;
}
```

### Good — phases breathe

```dart
Future<Post> createPost(PostRepository repository, CreatePostInput input) async {
  final id = nanoid();
  final now = clock.now();

  if (input.title.trim().isEmpty) throw ArgumentError('title required');
  if (input.title.length > 200) throw ArgumentError('title too long');

  final post = await repository.create(
    id: id,
    title: input.title,
    body: input.body,
    createdAt: now,
  );

  logger.info('post created', {'id': id});

  if (input.publish) {
    await repository.publish(id);
    logger.info('post published', {'id': id});
  }

  return post;
}
```

### Widget build methods

```dart
class PostList extends ConsumerWidget {
  const PostList({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final filter = ref.watch(postFilterProvider);
    final posts = ref.watch(postsProvider);

    final filtered = posts.where((post) => post.title.contains(filter)).toList();

    if (filtered.isEmpty) return const EmptyState();

    return ListView.builder(
      itemCount: filtered.length,
      itemBuilder: (context, index) => PostTile(post: filtered[index]),
    );
  }
}
```

Watches group → derived value → guard → return. Each phase gets its own paragraph.

## Edge cases / non-rules

- **Expression-bodied functions** stay tight — no blank line for `bool isAdult(int age) => age >= 18;`.
- **Sequential `final`s** that compute related values stay grouped (no blank lines between them):

  ```dart
  final now = clock.now();
  final id = nanoid();
  final slug = slugify(input.title);
  ```

- **Inside widget constructor argument lists**, no blank lines — that is where `dart format` already wins. A deeply nested widget tree is separated by structure, not whitespace.
- **Inside a `switch` expression**, no blank lines between arms. If a switch expression is long enough to want them, the arms are doing too much and should call named functions.
- **Method chains** — no blank lines between `.where(...).map(...).toList()`.

## Why no formatter enforcement

`dart format` is deliberately opinionated about line breaking and deliberately silent about blank lines: it normalises indentation, wrapping, and trailing commas, but treats vertical whitespace inside a body as authorial intent and preserves it. That means blank lines you add are durable and will not be reformatted away. If mechanical enforcement is ever needed, a custom lint via `custom_lint` is the escape hatch, but the convention is meant to be held by the writer.
