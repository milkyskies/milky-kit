import app from "./app"
import { readBindings } from "./infrastructure/bun-env"

const server = Bun.serve({
	port: Number(process.env.PORT ?? 3000),
	fetch: (request) => app.fetch(request, readBindings(process.env)),
})

console.log(`listening on ${server.url}`)
