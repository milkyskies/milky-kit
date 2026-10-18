## frontdesk

### Coordinator
- machine: <the Orca machine name the coordinator runs on>
- ask: ask:choices
- check: mise run check
- land: land:check

### Machines
<!-- One line per machine that runs workers: "- Minerva: workers 3". A remote machine adds its repository selector: "- zeus: workers 2, repo `~/Code/Projects/name`". With no lines, workers run only on the coordinator machine, 3 at a time. -->

### Hard areas
<!-- Path globs where the routing table's hard-area row applies: "- `apps/api/src/domain/**` - business rules; nothing to copy". -->

### Review paths
<!-- Path globs that bring in the standing reviewer: "- `apps/api/drizzle/migrations/**`". A `land:auto` request whose diff touches one of these waits for a clean review comment before the frontdesk merges it. -->

### Routing
<!-- Extra rows, read before the kit's table and winning over it. A line "- reuse landed workers: yes" lets the coordinator reuse a landed worker's terminal for a new request; see skills/frontdesk/reference/routing.md. -->

### Preflight
<!-- One command per line with its fix: "- `pg_isready -h localhost -p 5432` - fix: `docker compose up -d db`". Name MCP servers workers need beyond Serena: "- mcp: blender". -->

### Blocked commands

### Holds
