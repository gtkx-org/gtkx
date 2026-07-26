import { type Type, typeIsA } from "@gtkx/gi/gobject";
import { type ExternalObject, getType, type Handle } from "@gtkx/native";
import { TYPE_INVALID } from "@gtkx/runtime";

export function instanceIsA(handle: ExternalObject<Handle>, gtype: Type): boolean {
    const instanceGtype: Type = getType(handle);
    if (instanceGtype === TYPE_INVALID) return false;
    return typeIsA(instanceGtype, gtype);
}
