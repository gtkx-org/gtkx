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

import { Variant } from "../generated/glib/glib.js";
import { Value } from "../generated/gobject/gobject.js";
import { readBoxed, writeBoxed } from "./gvalue.js";
import { setVariantClass } from "./gvalue-native.js";

setVariantClass(Variant);

Value.prototype.getBoxed = function getBoxed<T = unknown>(this: Value): T {
    return readBoxed(this) as T;
};

Value.prototype.setBoxed = function setBoxed(this: Value, vBoxed: object | null): void {
    writeBoxed(this, vBoxed);
};
