# Effect MCP: `@effect/ai` `McpServer`

This rule adds the MCP (Model Context Protocol) inbound adapter to an Effect project. Assumes the `effect` module is already in place — the paradigm, clean-architecture layout, and use-case discipline come from there. This rule only describes the `presentation/mcp/` adapter.

## Where things live

```
src/                                  (or apps/<app>/src/)
└── presentation/
    └── mcp/
        ├── server.ts                 McpServer + transport composition (stdio, HTTP, SSE).
        └── <resource>.ts             McpServer tools wired to use cases.
```

- `presentation/mcp/` is the only place MCP types (`McpServer`, `Tool`) appear. Use cases never import from `@effect/ai`.

## Tools are use cases, picked for agent ergonomics

- One MCP tool per use case the agent should be able to invoke. The tool's `parameters` Schema is the use-case Input Schema — the same one any other adapter (HTTP, CLI, Matrix) uses.
- **Curate the MCP surface separately from other adapters.** Agents benefit from coarser, intention-shaped tools (`summarizeAndUpdatePost`) than HTTP needs (`getPost` + `updatePost`). Same use cases as building blocks, different selection per protocol — the kit pattern is: each adapter chooses which use cases to expose, never re-implements logic.
- New agent-shaped operation → new use case, not a special MCP-only handler.

## Tool handlers are shims

- Per the use-case-mandatory rule from `effect.md`: each tool handler is a 3-line shim. Parse input (Schema does it), call the use case, return the result. No business logic in `presentation/mcp/`.
- If you find yourself orchestrating multiple use cases inside an MCP tool, that orchestration is a new use case.

## Server composition

- The MCP server is a `Layer` like everything else. Compose into `AppLive` alongside whatever else the app runs (HTTP server, workers).
- Pick the transport at composition time: `McpServer.layerStdio` for local agent integration (Claude Desktop, MCP clients launching the binary), HTTP/SSE for remote.

## Errors

- Tools return Effects. Typed errors from the use case (the `E` channel) surface to the agent as structured tool errors via the `McpServer` runtime. No try/catch in the handler.
- If the agent should see a different error shape than the HTTP client does, transform at the `presentation/mcp/<resource>.ts` boundary with `Effect.mapError` — do not change the use case's error type.

## Testing MCP

- **Domain tier**: every use case exposed as an MCP tool has a domain-tier test (same test as if it were exposed over HTTP — protocol-agnostic).
- **E2E tier (opt-in)** (`tests/e2e/`): launch the MCP server in-process and call tools through the `McpClient`. Skip unless tool dispatch itself needs verifying.
