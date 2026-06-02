/**
 * The `@gtkx/ffi` public barrel.
 *
 * Surfaces the hand-written runtime symbols the generated `@gtkx/gi` bindings
 * and their augment overlay import at module-load and call time, plus the
 * narrow surface internal packages (`@gtkx/react`, `@gtkx/testing`) consume
 * directly. The runtime subset generated code depends on is aggregated in
 * `./runtime.js` and re-exported here, keeping `@gtkx/ffi` a single
 * transparent runtime specifier rather than a fan of subpaths.
 *
 * The FFI `Type` descriptor from `@gtkx/native` is re-exported as `FfiType`
 * so the GObject fundamental `Type` constants own the unqualified name.
 */

export * from "./gobject/fundamental-types.js";
export { getBoxed, setBoxed, valueGetType } from "./gobject/gvalue.js";
export { GValue, setVariantClass } from "./gobject/gvalue-native.js";
export { Type } from "./gobject/types.js";
export * from "./gtype.js";
export * from "./lifecycle.js";
export type { ErrorDomain, Type as FfiType } from "./native.js";
export { findObjectProperty, getInstanceGType } from "./native.js";
export { constructGObjectInstance } from "./object.js";
export { registerClass } from "./register-class.js";
export { getNativeClassByName, wrapHandle } from "./registry.js";
export * from "./runtime.js";
export type { SignalHandler } from "./signals.js";
export * from "./value-marshal.js";
