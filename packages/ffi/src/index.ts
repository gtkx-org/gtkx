/**
 * The `@gtkx/ffi` runtime barrel.
 *
 * Aggregates every hand-written runtime symbol the generated `@gtkx/gi`
 * bindings and their augment overlay import at module-load and call time, plus
 * the narrow surface internal packages (`@gtkx/react`, `@gtkx/testing`) consume
 * directly. Routing all of it through one entry keeps `@gtkx/ffi` a single
 * transparent runtime specifier rather than a fan of subpaths.
 *
 * The FFI `Type` descriptor from `@gtkx/native` is intentionally not
 * re-exported here so the GObject fundamental `Type` constants own the name.
 */

export * from "./gobject/fundamental-types.js";
export { readBoxed, writeBoxed } from "./gobject/gvalue.js";
export { GValue, setVariantClass } from "./gobject/gvalue-native.js";
export { Type } from "./gobject/types.js";
export * from "./gtype.js";
export { NativeObject } from "./handles.js";
export * from "./lifecycle.js";
export type { ErrorDomain, GError } from "./native.js";
export { findObjectProperty, getInstanceGType } from "./native.js";
export { constructGObjectInstance } from "./object.js";
export { type RegisterClassOptions, registerClass } from "./register-class.js";
export { getNativeClassByName, wrapHandle } from "./registry.js";
export * from "./runtime.js";
export * from "./value-marshal.js";
