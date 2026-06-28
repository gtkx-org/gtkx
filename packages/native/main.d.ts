/**
 * Hand-written entry point for `@gtkx/native`.
 *
 * Re-exposes the full napi-generated runtime surface, runs the GLib main-loop
 * thread as an import side effect, and overrides `quit` with the no-argument
 * form that tears down the loop this module owns.
 *
 * napi-rs emits the opaque external handles as bare marker identifiers inside
 * `ExternalObject<…>` (e.g. `ExternalObject<Handle>`) without declaring them.
 * Augmenting the generated module binds those references so the generated
 * signatures resolve, and exports the markers so callers can name them.
 */
export * from "./index.js";

declare module "./index.js" {
    /** An opaque pointer to a native value: a `GObject`, a boxed value, or a freshly allocated slot. */
    export type Handle = { __opaque: "Handle" };

    /** A compiled native call signature produced by `bind` and invoked by `call`. */
    export type CallDescriptor = { __opaque: "CallDescriptor" };

    /** The GLib main loop owned by the native addon, created by `init` and torn down by `quit`. */
    export type MainLoop = { __opaque: "MainLoop" };
}

/**
 * Quits the GLib main loop spawned when this module was imported and joins its
 * thread. Idempotent: subsequent calls are no-ops.
 */
export declare function quit(): void;
