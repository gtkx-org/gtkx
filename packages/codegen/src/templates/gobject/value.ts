/**
 * Runtime overrides for `GObject.Value`'s boxed accessors.
 *
 * `g_value_get_boxed` and `g_value_set_boxed` exchange a type-erased
 * `gpointer`, which codegen cannot marshal — it emits throwing stubs in their
 * place. These overrides install working implementations backed by the
 * registry-aware boxed marshalling in `./gvalue.js`.
 */

import { getGvalueBoxed, setGvalueBoxed } from "@gtkx/ffi";
import { type GType, Value } from "../gobject.js";

/**
 * Builds a `GObject.Value` of the given `GType`, runs `populate` to set its
 * payload, and returns it.
 *
 * Use this to hand a typed value to GTK APIs that take a raw `GValue`, such as
 * `Gdk.ContentProvider.newForValue`.
 *
 * @param gtype - The `GType` to initialize the value with.
 * @param populate - Callback that sets the value's payload via `setString`,
 *   `setBoxed`, `setObject`, etc.
 * @returns The initialized and populated value.
 * @example
 * ```ts
 * const value = buildValue(GObject.TYPE_STRING, (v) => v.setString("hello"));
 * ```
 */
export const buildValue = (gtype: GType, populate: (value: Value) => void): Value => {
    const value = new Value();
    value.init(gtype);
    populate(value);
    return value;
};

Value.prototype.getBoxed = function <T = unknown>(this: Value): T {
    return getGvalueBoxed(this) as T;
};

Value.prototype.setBoxed = function (this: Value, boxed: object | null): void {
    setGvalueBoxed(this, boxed);
};
