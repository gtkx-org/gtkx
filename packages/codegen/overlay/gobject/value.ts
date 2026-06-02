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
import { Value } from "@gtkx/gi/gobject/gobject.js";

setVariantClass(Variant);

Value.prototype.getBoxed = function <T = unknown>(this: Value): T {
    return getBoxed(this) as T;
};

Value.prototype.setBoxed = function (this: Value, boxed: object | null): void {
    setBoxed(this, boxed);
};
