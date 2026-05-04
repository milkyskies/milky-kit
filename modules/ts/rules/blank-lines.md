---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# Blank lines (kaigyou)

Use blank lines to separate the *phases* of a function: setup → validate → work → return. Reading top-to-bottom should feel like reading a paragraph, not a wall of text.

Biome doesn't enforce this — it only preserves whatever you write. So the rule is on you (and on agents writing code in this project).

## Rules

1. **Blank line before `return`** — unless `return` is the entire body.
2. **Blank line before/after every block** (`if`, `for`, `while`, `try`, `switch`) — unless the block is the first or last statement of its parent.
3. **Blank line after early-return guards** — `if (!x) return;` separates "validation" from "real work".
4. **Blank line between groups of single-line statements that do different things** — assignments → side effects → return.
5. **No blank line between consecutive variable declarations** that compute related values — they group as one "declaration block".
6. **No blank line between chained method calls / sequential operations** that conceptually do one thing.
7. **Blank line between the `import` block and the first real statement** (this is already standard).

## Examples

### Bad — wall of code

```ts
function createPost(repo: PostRepository, input: CreatePostInput) {
	const id = nanoid();
	const now = new Date();
	if (!input.title.trim()) throw new Error("title required");
	if (input.title.length > 200) throw new Error("title too long");
	const post = repo.create({ id, title: input.title, body: input.body, createdAt: now, updatedAt: now });
	logger.info("post created", { id });
	if (input.publish) {
		await repo.publish(id);
		logger.info("post published", { id });
	}
	return post;
}
```

### Good — phases breathe

```ts
function createPost(repo: PostRepository, input: CreatePostInput) {
	const id = nanoid();
	const now = new Date();

	if (!input.title.trim()) throw new Error("title required");
	if (input.title.length > 200) throw new Error("title too long");

	const post = repo.create({
		id,
		title: input.title,
		body: input.body,
		createdAt: now,
		updatedAt: now,
	});

	logger.info("post created", { id });

	if (input.publish) {
		await repo.publish(id);
		logger.info("post published", { id });
	}

	return post;
}
```

### React component

```tsx
function PostList() {
	const [filter, setFilter] = useState("");
	const { data: posts } = useSuspenseQuery(getPostsQueryOptions());

	const filtered = posts.filter((post) => post.title.includes(filter));

	if (filtered.length === 0) return <Empty />;

	return (
		<ul>
			{filtered.map((post) => (
				<li key={post.id}>{post.title}</li>
			))}
		</ul>
	);
}
```

Hooks group → derived value → guard → return. Each phase gets its own paragraph.

## Edge cases / non-rules

- **Single-statement function** stays tight — no blank line for `const isAdult = (age: number) => age >= 18;`.
- **Sequential `const`s** that compute related values stay grouped (no blank lines between them):
	```ts
	const now = new Date();
	const id = nanoid();
	const slug = slugify(input.title);
	```
- **Inside object literals or JSX**, no blank lines — that's where the formatter already wins.
- **Method chains** — no blank lines between `.then(...).catch(...)` or `db.select().from().where()`.

## Why no formatter enforcement

Biome (and oxlint, oxfmt) explicitly do not implement padding-line / blank-line rules — those tools defer stylistic concerns to the writer. The formatter preserves blank lines you add and won't strip them, so applying these rules is durable. If mechanical enforcement is needed later, eslint-stylistic's `padding-line-between-statements` rule covers it.
