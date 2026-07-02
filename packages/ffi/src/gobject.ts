import type { Descriptor, ExternalObject, Handle } from "@gtkx/native";
import { GVALUE_SIZE, GVALUE_T, LIB } from "./constants.js";
import { biguint64T, bind, objectT, sizedArrayT, stringT, uint32T, voidT } from "./descriptors.js";
import { fromGValue, newGValueForDescriptor, toGValue } from "./gvalue.js";
import { getHandle } from "./registry.js";

type Property = [Descriptor, unknown];

const gObjectNewWithProperties = bind(
    LIB,
    "g_object_new_with_properties",
    [
        biguint64T,
        uint32T,
        sizedArrayT(stringT("borrowed"), 1, "borrowed"),
        sizedArrayT(GVALUE_T, 1, "borrowed", GVALUE_SIZE),
    ],
    objectT("full"),
);

export function newGObjectWithProperties(gtype: bigint, props: Record<string, Property>): ExternalObject<Handle> {
    const names: string[] = [];
    const values: ExternalObject<Handle>[] = [];

    for (const name in props) {
        const entry = props[name];
        if (entry === undefined) continue;
        const [descriptor, value] = entry;
        if (value === undefined) continue;
        names.push(name);
        values.push(toGValue(descriptor, value));
    }

    return gObjectNewWithProperties(gtype, names.length, names, values) as ExternalObject<Handle>;
}

const PROPERTY_CALL_ARGS = [objectT("borrowed"), stringT("borrowed"), GVALUE_T] as const;

const gObjectGetProperty = bind(LIB, "g_object_get_property", [...PROPERTY_CALL_ARGS], voidT);
const gObjectSetProperty = bind(LIB, "g_object_set_property", [...PROPERTY_CALL_ARGS], voidT);

export function getGObjectProperty(obj: object, propertyName: string, descriptor: Descriptor): unknown {
    const value = newGValueForDescriptor(descriptor);
    gObjectGetProperty(getHandle(obj), propertyName, value);
    return fromGValue(value);
}

export function setGObjectProperty(obj: object, propertyName: string, descriptor: Descriptor, jsValue: unknown): void {
    gObjectSetProperty(getHandle(obj), propertyName, toGValue(descriptor, jsValue));
}
