/**
 * The `@gtkx/ffi` public barrel.
 *
 * Surfaces the hand-written runtime helpers the generated `@gtkx/gi` bindings
 * and their override templates import at module-load and call time, plus the
 * narrow surface internal packages (`@gtkx/react`, `@gtkx/testing`) consume
 * directly. The helper subset generated code depends on is aggregated in
 * `./runtime.js` and re-exported here, keeping `@gtkx/ffi` a single
 * transparent helper specifier.
 *
 * The call convention is the higher-level surface generated code targets:
 * `ffiCall` dispatches a callable with out-parameter tupling, `GError`
 * handling, and result wrapping; `emitGobjectSignal`/`connectGobjectSignal`
 * own signal emission and connection; `newGobjectWithProperties`,
 * `getGobjectProperty`/`setGobjectProperty`, and `getGvalueBoxed`/`setGvalueBoxed`
 * cover construction, property access, and boxed `GValue` payloads, and
 * `wrapFfiValue` lifts a raw native value to its typed wrapper from an FFI
 * descriptor. The `GValue` marshalling primitives and the registry wrappers
 * (`getNativeObject`/`getNativeObjectAsInterface`) those build on stay internal.
 *
 * Low-level transport primitives (`alloc`, `call`, `read`, `write`) and the
 * native handle and FFI-descriptor types are not surfaced here; generated
 * bindings import those straight from `@gtkx/native`, leaving `@gtkx/ffi` the
 * home of higher-level runtime helpers only. The non-introspectable cairo
 * helpers live behind the `@gtkx/ffi/cairo` subpath for the same reason.
 */

export * from "./gobject/fundamental-types.js";
export { getGvalueBoxed, setGvalueBoxed } from "./gobject/gvalue.js";
export { setVariantClass } from "./gobject/gvalue-native.js";
export { Type } from "./gobject/types.js";
export * from "./gtype.js";
export * from "./lifecycle.js";
export * from "./listeners.js";
export type { ErrorDomain } from "./native.js";
export { newGobjectWithProperties } from "./object.js";
export { registerClass } from "./register-class.js";
export { getNativeClassByName, wrapHandle } from "./registry.js";
export * from "./runtime.js";
export type { SignalHandler } from "./signals.js";
export { getGobjectProperty, setGobjectProperty } from "./value-marshal.js";
