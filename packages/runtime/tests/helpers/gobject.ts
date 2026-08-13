import { Object as GObject, type ParamSpec, type Type, TYPE_STRING, typeIsA, Value } from "@gtkx/gi/gobject";
import { type ExternalObject, getType, type Handle } from "@gtkx/native";
import { TYPE_INVALID, TYPE_POINTER } from "@gtkx/runtime";

function isInstanceOfType(handle: ExternalObject<Handle>, gtype: Type): boolean {
    const instanceGtype: Type = getType(handle);

    if (instanceGtype === TYPE_INVALID) {
        return false;
    }

    return typeIsA(instanceGtype, gtype);
}

function valueOfType(gtype: Type): Value {
    const value = new Value();
    value.init(gtype);

    return value;
}

function stringValue(text: string): Value {
    const value = valueOfType(TYPE_STRING);
    value.setString(text);

    return value;
}

function pointerValue(): Value {
    return valueOfType(TYPE_POINTER);
}

function watchNotify(instance: GObject): string[] {
    const seen: string[] = [];

    instance.on("notify", (...args: unknown[]) => {
        const [pspec] = args as [ParamSpec];
        seen.push(pspec.getName());
    });

    return seen;
}

export { isInstanceOfType, pointerValue, stringValue, valueOfType, watchNotify };
