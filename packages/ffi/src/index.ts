/**
 * The `@gtkx/ffi` public barrel.
 *
 * Surfaces the hand-written runtime helpers the generated `@gtkx/gi` bindings
 * and their augment overlay import at module-load and call time, plus the
 * narrow surface internal packages (`@gtkx/react`, `@gtkx/testing`) consume
 * directly. The helper subset generated code depends on is aggregated in
 * `./runtime.js` and re-exported here, keeping `@gtkx/ffi` a single
 * transparent helper specifier.
 *
 * Low-level transport primitives (`alloc`, `call`, `read`, `write`) and the
 * native handle and FFI-descriptor types are not surfaced here; generated
 * bindings import those straight from `@gtkx/native`, leaving `@gtkx/ffi` the
 * home of higher-level runtime helpers only.
 */

export * from "./gobject/fundamental-types.js";
export { getBoxed, setBoxed, valueGetType } from "./gobject/gvalue.js";
export { GValue, setVariantClass } from "./gobject/gvalue-native.js";
export { Type } from "./gobject/types.js";
export * from "./gtype.js";
export * from "./lifecycle.js";
export type { ErrorDomain } from "./native.js";
export { constructGObjectInstance } from "./object.js";
export { registerClass } from "./register-class.js";
export { getNativeClassByName, wrapHandle } from "./registry.js";
export * from "./runtime.js";
export type { SignalHandler } from "./signals.js";
export * from "./value-marshal.js";
