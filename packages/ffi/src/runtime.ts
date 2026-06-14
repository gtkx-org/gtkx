/**
 * Consolidated runtime surface for generated FFI bindings.
 *
 * Every generated `.js` file imports its load-time and call-time runtime
 * dependencies from this module. Routing those imports through one specifier
 * keeps the generated import header compact and decouples generated code from
 * the internal module layout of `@gtkx/ffi`.
 *
 * `newGobjectWithProperties` is deliberately *not* re-exported here. It lives in
 * `./object.js`, which transitively imports back into this barrel via
 * `./gobject/gvalue.js`. Re-exporting it would close an import cycle through the
 * barrel and impose a load-order constraint on every export below. Generated
 * files import it from the `@gtkx/ffi` package barrel (`index.ts`) instead,
 * leaving this barrel fully acyclic and order-independent.
 */

export { promisify } from "./async.js";
export { emitGobjectSignal } from "./emit-signal.js";
export { ffiCall } from "./ffi-call.js";
export { getHandle, setHandle, tryGetHandle } from "./handles.js";
export { t } from "./helpers.js";
export { checkError, createErrorDomain } from "./native.js";
export { registerNativeClass } from "./register-native-class.js";
export { connectGobjectSignal, signalBaseName } from "./signals.js";
export { wrapFfiValue } from "./wrap-value.js";
