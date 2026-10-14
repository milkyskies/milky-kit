---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# Effect MCP: `effect/ai` `McpServer`

This rule adds the MCP (Model Context Protocol) inbound adapter to an Effect project. Assumes the `effect` module is already in place — the paradigm, clean-architecture layout, and use-case discipline come from there. This rule only describes the `presentation/mcp/` adapter.

Effect 4 ships the MCP server inside `effect` at `effect/ai` (`McpServer`, `McpProtocol`, `Tool`, `Toolkit`). The separate `@effect/ai` package is gone. No extra install is needed.

## Where things live

```
src/                                  (or apps/<app>/src/)
└── presentation/
    └── mcp/
        ├── <resource>-tools.ts       Tool.make definitions, Toolkit.make, and handlers wired to use cases.
        ├── toolkits.ts               McpServer.toolkit(...) registrations, transport-agnostic.
        └── server.ts                 Transport layers: McpServer.layerHttp and McpServer.layerStdio.
```

- `presentation/mcp/` is the only place MCP types (`McpServer`, `Tool`, `Toolkit`) appear. Use cases never import from `effect/ai`.

## Tools are use cases, picked for agent ergonomics

- One MCP tool per use case the agent should be able to invoke. The tool's `parameters` Schema is the use-case Input Schema — the same one any other adapter (HTTP, CLI, Matrix) uses.
- **Curate the MCP surface separately from other adapters.** Agents benefit from coarser, intention-shaped tools (`summarizeAndUpdatePost`) than HTTP needs (`getPost` + `updatePost`). Same use cases as building blocks, different selection per protocol — the kit pattern is: each adapter chooses which use cases to expose, never re-implements logic.
- New agent-shaped operation → new use case, not a special MCP-only handler.

  ```ts
  import { Effect, Schema } from "effect"
  import { Tool, Toolkit } from "effect/ai"

  const GetPostTool = Tool.make("GetPost", {
    description: "Get a single post by id",
    parameters: GetPostInput,
    success: Post,
    dependencies: [PostRepository],
  })

  export const PostsToolkit = Toolkit.make(GetPostTool)

  export const PostsToolHandlersLive = PostsToolkit.toLayer({
    GetPost: (input) => getPost(input).pipe(Effect.orDie),
  })
  ```

- `dependencies` lists the services a tool's handler needs, so they surface as requirements on the handler layer and get provided once at the composition root.

## Tool handlers are shims

- Per the use-case-mandatory rule from `effect.md`: each tool handler is a 3-line shim. Parse input (Schema does it), call the use case, return the result. No business logic in `presentation/mcp/`.
- If you find yourself orchestrating multiple use cases inside an MCP tool, that orchestration is a new use case.

## Server composition

- The MCP server is a `Layer` like everything else. Register toolkits with `McpServer.toolkit(Toolkit)`, merge them, and provide a transport layer.
- Every transport takes a `protocols` array of adapters from `McpProtocol`. Pick the version deliberately, for example `McpProtocol.v2025_11_25`. `McpProtocol.v2026_07_28` is stateless and needed for `layerHttpRequestScoped`.

  ```ts
  import { BunStdio } from "@effect/platform-bun"
  import { Layer } from "effect"
  import { McpProtocol, McpServer } from "effect/ai"

  const SERVER_INFO = {
    name: "my-api",
    version: "0.0.0",
    protocols: [McpProtocol.v2025_11_25],
  } as const

  export const McpServerHttpLive = McpToolkitsLive.pipe(
    Layer.provide(McpServer.layerHttp({ ...SERVER_INFO, path: "/mcp" })),
  )

  export const McpServerStdioLive = McpToolkitsLive.pipe(
    Layer.provide(McpServer.layerStdio(SERVER_INFO)),
    Layer.provide(BunStdio.layer),
  )
  ```

- `layerHttp` needs an `HttpRouter`, so merge it into the same `HttpRouter.serve(...)` call as the REST routes. It rejects requests with an `Origin` header unless the origin appears in `allowedOrigins`. It installs no authentication; add that in the surrounding router.
- `layerStdio` needs `Stdio` (`BunStdio.layer`, or the Node equivalent). Stdout is the protocol wire, so the stdio entry point runs in its own process (`main-mcp.ts`) with no stdout logger.
- On Cloudflare Workers use `McpServer.layerHttpRequestScoped` with a stateless protocol, because a Worker has no process to hold a shared server.

## Tool success shape

- A tool's `success` schema must encode to an **object**, never a top-level array. MCP `structuredContent` is an object in the protocol.
- Wrap list results in a single-key struct and map in the handler:

  ```ts
  // tool
  success: Schema.Struct({ posts: Schema.Array(Post) })
  // handler
  ListPosts: () => listPosts({}).pipe(Effect.map((posts) => ({ posts })), Effect.orDie)
  ```

- Single-object results (`success: Post`) and `Schema.Struct({...})` are already fine. Only bare arrays need wrapping.

## Errors

- Tools return Effects. A tool's `failure` schema (default `Schema.Never`) is the typed error the agent can see. Use `failureMode: "return"` to hand failures back as part of the tool result instead of the error channel.
- If the agent should see a different error shape than the HTTP client does, transform at the `presentation/mcp/<resource>-tools.ts` boundary with `Effect.mapError` — do not change the use case's error type.

## Testing MCP

- **Domain tier**: every use case exposed as an MCP tool has a domain-tier test (same test as if it were exposed over HTTP — protocol-agnostic).
- **E2E tier (opt-in)** (`tests/e2e/`): launch the MCP server in-process and call tools through an MCP client. Skip unless tool dispatch itself needs verifying.
