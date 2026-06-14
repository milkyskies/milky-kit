# Production image for apps/{{app_name}} — serves REST (/api) + MCP (/mcp).
# Bun is the runtime; pnpm resolves the workspace install. Migrations run on start
# via drizzle-orm's programmatic migrator (Bun-native), so the image needs neither
# Node nor drizzle-kit — see apps/{{app_name}}/scripts/migrate.ts.
FROM oven/bun:1.2.10

WORKDIR /app

# Keep this pnpm version in sync with the root package.json `packageManager`.
RUN bun install -g pnpm@10.29.3

# Install production deps first, keyed only on the manifests, for layer caching.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/{{app_name}}/package.json ./apps/{{app_name}}/
RUN pnpm install --prod --frozen-lockfile --config.minimumReleaseAge=0

COPY apps/{{app_name}} ./apps/{{app_name}}

WORKDIR /app/apps/{{app_name}}
ENV NODE_ENV=production
EXPOSE 3000

# Apply pending migrations, then serve. A migration failure aborts the boot so a
# bad deploy surfaces instead of serving against a half-migrated database.
CMD ["sh", "-c", "bun scripts/migrate.ts && bun src/main.ts"]
