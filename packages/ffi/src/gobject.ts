import { call, type Type as FfiType, type Handle, type Value } from "@gtkx/native";
import { GVALUE_SIZE, GVALUE_T, LIB } from "./constants.js";
import { biguint64T, bind, objectT, sizedArrayT, stringT, uint32T, voidT } from "./descriptors.js";
import type { GType } from "./gtype.js";
import { fromGvalue, newValueFromFfi, toGvalue } from "./gvalue.js";
import { getHandle } from "./registry.js";

type Property = [FfiType, Value];

export function newGobjectWithProperties(gtype: GType, props: Record<string, Property>): Handle {
    const names: string[] = [];
    const values: Handle[] = [];

    for (const name in props) {
        const entry = props[name];
        if (entry === undefined) continue;
        const [ffiType, value] = entry;
        if (value === undefined) continue;
        names.push(name);
        values.push(toGvalue(ffiType, value));
    }

    return call(
        LIB,
        "g_object_new_with_properties",
        [
            { type: biguint64T, value: gtype },
            { type: uint32T, value: names.length },
            { type: sizedArrayT(stringT("borrowed"), 1, "borrowed"), value: names },
            { type: sizedArrayT(GVALUE_T, 1, "borrowed", GVALUE_SIZE), value: values },
        ],
        objectT("full"),
    ) as Handle;
}

const PROPERTY_CALL_ARGS = [objectT("borrowed"), stringT("borrowed"), GVALUE_T] as const;

const gObjectGetProperty = bind(LIB, "g_object_get_property", [...PROPERTY_CALL_ARGS], voidT);
const gObjectSetProperty = bind(LIB, "g_object_set_property", [...PROPERTY_CALL_ARGS], voidT);

export function getGobjectProperty(obj: object, propertyName: string, ffiType: FfiType): unknown {
    const value = newValueFromFfi(ffiType);
    gObjectGetProperty(getHandle(obj), propertyName, value);
    return fromGvalue(value);
}

export function setGobjectProperty(obj: object, propertyName: string, ffiType: FfiType, jsValue: unknown): void {
    gObjectSetProperty(getHandle(obj), propertyName, toGvalue(ffiType, jsValue));
}
