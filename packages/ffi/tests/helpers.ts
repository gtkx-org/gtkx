import { TYPE_INVALID, typeIsA } from "@gtkx/ffi";
import type { GType } from "@gtkx/gi/gobject";
import { getGobjectGtype, type NativeHandle } from "@gtkx/native";

/**
 * Tests whether a `GTypeInstance`-compatible handle is an instance of `gtype`.
 *
 * Composes {@link getGobjectGtype} with `g_type_is_a`, so the check covers
 * both class inheritance and interface implementation in a single call.
 *
 * @param handle - Handle to a live GObject-compatible instance
 * @param gtype - GType identifier of the target type
 */
export function instanceIsA(handle: NativeHandle, gtype: GType): boolean {
    const instanceGtype: GType = getGobjectGtype(handle);
    if (instanceGtype === TYPE_INVALID) return false;
    return typeIsA(instanceGtype, gtype);
}
