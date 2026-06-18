/**
 * The `@gtkx/ffi` public barrel.
 *
 * Surfaces the hand-written runtime helpers the generated `@gtkx/gi` bindings
 * and their override templates import at module-load and call time, plus the
 * narrow surface internal packages (`@gtkx/react`, `@gtkx/testing`) consume
 * directly.
 *
 * The call convention is the higher-level surface generated code targets:
 * `t.fn` dispatches a callable with out-parameter tupling, `GError`
 * handling, and result wrapping; `emitGobjectSignal`/`connectGobjectSignal`
 * own signal emission and connection; `newGobjectWithProperties`,
 * `getGobjectProperty`/`setGobjectProperty`, and `getGvalueBoxed`/`setGvalueBoxed`
 * cover construction, property access, and boxed `GValue` payloads, and
 * `wrapValue` lifts a raw native value to its typed wrapper from an FFI
 * descriptor, and `wrapHandle` does the same from a known class. The `GValue`
 * marshalling primitives those build on stay internal.
 *
 * Low-level transport primitives (`alloc`, `call`, `read`, `write`) and the
 * native handle and FFI-descriptor types are not surfaced here; generated
 * bindings import those straight from `@gtkx/native`, leaving `@gtkx/ffi` the
 * home of higher-level runtime helpers only.
 */

export { promisify } from "./async.js";
export { createErrorDomain, type ErrorDomain } from "./error.js";
export { getGobjectProperty, newGobjectWithProperties, setGobjectProperty } from "./gobject.js";
export * from "./gtype.js";
export { getGvalueBoxed, setGvalueBoxed } from "./gvalue.js";
export { t } from "./helpers.js";
export * from "./lifecycle.js";
export { registerClass } from "./register-class.js";
export { registerWrapperClass } from "./register-wrapper-class.js";
export { getHandle, getInstanceGtype, getWrapperClass, setHandle, tryGetHandle, wrapHandle } from "./registry.js";
export {
    connectGobjectSignal,
    emitGobjectSignal,
    offSignal,
    onceSignal,
    onSignal,
    type SignalHandler,
    signalBaseName,
} from "./signal.js";
export { wrapValue } from "./wrap-value.js";
