// No database bindings when db=none. `unknown` is the identity of `&`, so the composed `Bindings` type stays exactly the core and auth bindings.
export type DbBindings = unknown
