// No auth bindings when auth=none. Empty marker type so the base
// `Bindings = DbBindings & AuthBindings` composition still type-checks.
export type AuthBindings = Record<string, never>
