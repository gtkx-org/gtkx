import type { Descriptor, ExternalObject, Handle } from "@gtkx/native";
import { bind } from "./bind.js";
import { biguint64T, objectT, sizedArrayT, stringT, uint32T, voidT } from "./descriptors.js";
import { LIB, VALUE_SIZE, VALUE_T } from "./library.js";
import { getHandle } from "./registry.js";
import { fromValue, newValueForDescriptor, toValue } from "./value.js";

type Property = [Descriptor, unknown];

const gObjectNewWithProperties = bind(
    LIB,
    "g_object_new_with_properties",
    [
        biguint64T,
        uint32T,
        sizedArrayT(stringT("borrowed"), 1, "borrowed"),
        sizedArrayT(VALUE_T, 1, "borrowed", VALUE_SIZE),
    ],
    objectT("full"),
);

const gObjectGetProperty = bind(
    LIB,
    "g_object_get_property",
    [objectT("borrowed"), stringT("borrowed"), VALUE_T],
    voidT,
);
const gObjectSetProperty = bind(
    LIB,
    "g_object_set_property",
    [objectT("borrowed"), stringT("borrowed"), VALUE_T],
    voidT,
);

export function newObjectWithProperties(gtype: bigint, props: Record<string, Property>): ExternalObject<Handle> {
    const names: string[] = [];
    const values: ExternalObject<Handle>[] = [];

    for (const name in props) {
        const entry = props[name];
        if (entry === undefined) continue;
        const [descriptor, value] = entry;
        if (value === undefined) continue;
        names.push(name);
        values.push(toValue(descriptor, value));
    }

    return gObjectNewWithProperties(gtype, names.length, names, values) as ExternalObject<Handle>;
}

export function getObjectProperty(obj: object, propertyName: string, descriptor: Descriptor): unknown {
    const value = newValueForDescriptor(descriptor);
    gObjectGetProperty(getHandle(obj), propertyName, value);
    return fromValue(value);
}

export function setObjectProperty(obj: object, propertyName: string, descriptor: Descriptor, jsValue: unknown): void {
    gObjectSetProperty(getHandle(obj), propertyName, toValue(descriptor, jsValue));
}
