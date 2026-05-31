/**
 * Consolidated runtime surface for generated FFI bindings.
 *
 * Every generated `.js` file imports its load-time runtime dependencies from
 * this module. It aggregates the hand-written runtime that generated code
 * depends on, both at module-load time (type registration, construction
 * metadata) and at call time (handle resolution, object wrapping, error
 * handling). Routing those imports through one specifier keeps the generated
 * import header compact and decouples generated code from the internal
 * module layout of `@gtkx/ffi`.
 *
 * `constructGObjectInstance` is deliberately *not* re-exported here. It lives
 * in `./object.js`, which transitively imports back into this barrel via
 * `./gobject/gvalue.js`. Re-exporting it would close an import cycle through
 * the barrel and impose a load-order constraint on every export below.
 * Generated files import it directly from `../../object.js` instead, leaving
 * this barrel fully acyclic and order-independent.
 */

export { promisify } from "./async.js";
export type { ClassVFuncMeta, NativeClass, NativeHandle } from "./handles.js";
export { getHandle, setHandle, tryGetHandle } from "./handles.js";
export type { ArrayKind, ArrayOptions, Ownership, TrampolineOptions, TrampolineScope } from "./helpers.js";
export { alloc, call, freeze, getNativeId, read, t, unfreeze, write } from "./helpers.js";
export { checkError, makeErrorDomain } from "./native.js";
export type { NativeClassDescriptor, NativeClassRole, NativeSignalRegistration } from "./register-native-class.js";
export { registerNativeClass } from "./register-native-class.js";
export { getNativeObject, getNativeObjectAsInterface } from "./registry.js";
export type { SignalDescriptor, SignalGObject, SignalGValue, SignalHandler } from "./signals.js";
export { connectSignal, emitSignal } from "./signals.js";
