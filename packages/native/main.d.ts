export * from "./index.js";

declare module "./index.js" {
    /**
     * An opaque handle to a native memory region: a GObject, a boxed value, or a raw allocation.
     * Produced by `alloc` and consumed by the memory and wrapper functions (`read`, `write`,
     * `copy`, `getType`, `getWrapper`, `setWrapper`). Its bytes are not accessible from JavaScript.
     */
    export type Handle = { _opaque: "Handle" };
    /**
     * An opaque, precompiled binding of a native function, produced by `bind` and passed to `call`.
     * It captures the resolved symbol and the marshalling of its arguments and return value.
     */
    export type CallDescriptor = { _opaque: "CallDescriptor" };
    /**
     * A mutable box for an out or inout ('ref' descriptor) parameter. Pass an object with a `value`
     * property; after `call` returns, its `value` holds the decoded native result.
     */
    export type Ref = { value: unknown };
}
