import { type Type, TYPE_STRING, typeIsA, Value } from "@gtkx/gi/gobject";
import { type ExternalObject, getType, type Handle } from "@gtkx/native";
import { TYPE_INVALID, TYPE_POINTER } from "@gtkx/runtime";

function isInstanceOfType(handle: ExternalObject<Handle>, gtype: Type): boolean {
    const instanceGtype: Type = getType(handle);

    if (instanceGtype === TYPE_INVALID) {
        return false;
    }

    return typeIsA(instanceGtype, gtype);
}

function stringValue(text: string): Value {
    const value = new Value();
    value.init(TYPE_STRING);
    value.setString(text);

    return value;
}

function pointerValue(): Value {
    const value = new Value();
    value.init(TYPE_POINTER);

    return value;
}

export { isInstanceOfType, pointerValue, stringValue };
