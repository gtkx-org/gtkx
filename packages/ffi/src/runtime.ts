/**
 * Consolidated runtime surface for generated FFI bindings.
 *
 * Every generated `.js` file imports its load-time runtime dependencies from
 * this module. It aggregates the hand-written runtime that generated code
 * depends on, both at module-load time (type registration) and at call time
 * (handle resolution, object wrapping, error handling). Routing those imports
 * through one specifier keeps the generated
 * import header compact and decouples generated code from the internal
 * module layout of `@gtkx/ffi`.
 *
 * `constructGObjectInstance` is deliberately *not* re-exported here. It lives
 * in `./object.js`, which transitively imports back into this barrel via
 * `./gobject/gvalue.js`. Re-exporting it would close an import cycle through
 * the barrel and impose a load-order constraint on every export below.
 * Generated files import it from the `@gtkx/ffi` package barrel (`index.ts`)
 * instead, leaving this barrel fully acyclic and order-independent.
 */

export { promisify } from "./async.js";
export { getHandle, setHandle, tryGetHandle } from "./handles.js";
export { t } from "./helpers.js";
export { checkError, createErrorDomain } from "./native.js";
export { registerNativeClass } from "./register-native-class.js";
export { getNativeObject, getNativeObjectAsInterface } from "./registry.js";
export { connectSignal, signalBaseName } from "./signals.js";
