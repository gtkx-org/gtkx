import { TYPE_INVALID, typeIsA } from "@gtkx/ffi";
import type { GType } from "@gtkx/gi/gobject";
import { getType, type Handle } from "@gtkx/native";

export function instanceIsA(handle: Handle, gtype: GType): boolean {
    const instanceGtype: GType = BigInt(getType(handle));
    if (instanceGtype === TYPE_INVALID) return false;
    return typeIsA(instanceGtype, gtype);
}
