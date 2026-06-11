/**
 * Runtime overrides for `GObject.Value`'s boxed accessors, plus registration
 * of the `GLib.Variant` wrapper class with the hand-written value layer.
 *
 * `g_value_get_boxed` and `g_value_set_boxed` exchange a type-erased
 * `gpointer`, which codegen cannot marshal — it emits throwing stubs in their
 * place. These overrides install working implementations backed by the
 * registry-aware boxed marshalling in `./gvalue.js`.
 *
 * `GVariant` is a non-GObject fundamental with no registered `GType`, so the
 * hand-written {@link GValue} cannot resolve its wrapper from the registry.
 * This module supplies the concrete class via {@link setVariantClass}.
 */

import { getBoxed, setBoxed, setVariantClass } from "@gtkx/ffi";
import { Variant } from "@gtkx/gi/glib/glib.js";
import { type GType, Value } from "@gtkx/gi/gobject/gobject.js";

setVariantClass(Variant);

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
    return getBoxed(this) as T;
};

Value.prototype.setBoxed = function (this: Value, boxed: object | null): void {
    setBoxed(this, boxed);
};
