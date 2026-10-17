# Production image for apps/{{app_name}}. Bun is the runtime and runs the TypeScript source directly; pnpm resolves the workspace install.
FROM oven/bun:1.3.14

WORKDIR /app

# Keep this pnpm version in sync with the root package.json `packageManager`.
RUN bun install -g pnpm@11.18.0

# Install production deps first, keyed only on the manifests, for layer caching.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/{{app_name}}/package.json ./apps/{{app_name}}/
RUN pnpm install --prod --frozen-lockfile --config.minimumReleaseAge=0

COPY apps/{{app_name}} ./apps/{{app_name}}

WORKDIR /app/apps/{{app_name}}
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# `exec` makes Bun PID 1 so it receives SIGTERM on `docker stop` and shuts down gracefully; sh would otherwise swallow the signal and get SIGKILLed after the grace period.
CMD ["sh", "-c", "exec bun src/main.ts"]
