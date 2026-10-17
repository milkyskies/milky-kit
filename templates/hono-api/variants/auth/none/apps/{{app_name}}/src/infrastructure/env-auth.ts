// No auth bindings when auth=none. `unknown` is the identity of `&`, so the base `Bindings = CoreBindings & DbBindings & AuthBindings` composition stays assignable from a plain object (the Bun runtime builds one from the process environment).
export type AuthBindings = unknown
