# Blank lines (kaigyou)

Use blank lines to separate the *phases* of a function: setup -> validate -> work -> return. Reading top-to-bottom should feel like reading a paragraph, not a wall of text.

`zig fmt` does not enforce this — it preserves whatever you write. So the rule is on you (and on agents writing code in this project).

## Rules

1. **Blank line before `return`** — unless `return` is the entire body.
2. **Blank line before and after every block** (`if`, `for`, `while`, `switch`) — unless the block is the first or last statement of its parent.
3. **Blank line after early-return guards** — `if (!ok) return error.Foo;` separates "validation" from "real work".
4. **Blank line between groups of single-line statements that do different things** — declarations -> side effects -> return.
5. **No blank line between consecutive declarations** that compute related values — they group as one "declaration block".
6. **No blank line between chained or sequential operations** that conceptually do one thing.
7. **Blank line between the import block and the first declaration.**

## Examples

### Bad — wall of code

```zig
fn spawnAgent(world: *World, allocator: Allocator, spec: AgentSpec) !Entity {
    const id = world.nextEntityId();
    const pos = spec.spawn_pos;
    if (!world.map.isWalkable(pos)) return error.UnwalkableSpawn;
    if (world.agentCount() >= max_agents) return error.WorldFull;
    const agent = try allocator.create(Agent);
    errdefer allocator.destroy(agent);
    agent.* = .{ .id = id, .pos = pos, .needs = Needs.initial() };
    world.register(agent);
    return id;
}
```

### Good — phases breathe

```zig
fn spawnAgent(world: *World, allocator: Allocator, spec: AgentSpec) !Entity {
    const id = world.nextEntityId();
    const pos = spec.spawn_pos;

    if (!world.map.isWalkable(pos)) return error.UnwalkableSpawn;
    if (world.agentCount() >= max_agents) return error.WorldFull;

    const agent = try allocator.create(Agent);
    errdefer allocator.destroy(agent);

    agent.* = .{
        .id = id,
        .pos = pos,
        .needs = Needs.initial(),
    };

    world.register(agent);

    return id;
}
```

Declarations group -> guards -> allocation -> initialization -> side effect -> return. Each phase gets its own paragraph.

## Edge cases / non-rules

- **Single-expression function** stays tight — no blank line for `fn isAdult(age: u8) bool { return age >= 18; }`.
- **Sequential declarations** that compute related values stay grouped (no blank lines between them):
	```zig
	const now = clock.now();
	const id = world.nextEntityId();
	const pos = spec.spawn_pos;
	```
- **Inside struct literals or `switch` prongs**, no blank lines — that is where the formatter already wins.
- **Method chains and sequential builder calls** — no blank lines between steps that do one logical thing.
