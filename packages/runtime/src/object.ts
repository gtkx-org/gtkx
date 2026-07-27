import type { Descriptor, ExternalObject, Handle } from "@gtkx/native";
import { bind } from "./bind.js";
import { biguint64T, objectT, sizedArrayT, stringT, uint32T, voidT } from "./descriptors.js";
import { LIB, VALUE_SIZE, VALUE_T } from "./library.js";
import { getHandle } from "./registry.js";
import { fromValue, newValueForDescriptor, toValue } from "./value.js";

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

/**
 * Constructs a new GObject of the given type, setting the supplied construct
 * properties. Entries whose value is `undefined` or not a `[descriptor, value]`
 * pair are skipped.
 *
 * @param gtype The GType of the object to construct.
 * @param props Property names mapped to `[descriptor, value]` pairs.
 * @returns The handle of the newly created object.
 */
function newObjectWithProperties(gtype: bigint, props: Record<string, unknown>): ExternalObject<Handle> {
    const names: string[] = [];
    const values: ExternalObject<Handle>[] = [];

    for (const name in props) {
        const entry: unknown = props[name];

        if (!Array.isArray(entry)) {
            continue;
        }

        const [descriptor, value] = entry as [Descriptor, unknown];

        if (value === undefined) {
            continue;
        }

        names.push(name);
        values.push(toValue(descriptor, value));
    }

    return gObjectNewWithProperties(gtype, names.length, names, values) as ExternalObject<Handle>;
}

/**
 * Reads a GObject property and converts it to its JavaScript value using the
 * descriptor.
 *
 * @param obj The object to read from.
 * @param propertyName The property name.
 * @param descriptor Describes the property's type.
 */
function getObjectProperty(obj: object, propertyName: string, descriptor: Descriptor): unknown {
    const value = newValueForDescriptor(descriptor);
    gObjectGetProperty(getHandle(obj), propertyName, value);

    return fromValue(value);
}

/**
 * Writes a JavaScript value to a GObject property, converting it to native form
 * using the descriptor.
 *
 * @param obj The object to write to.
 * @param propertyName The property name.
 * @param descriptor Describes the property's type.
 * @param jsValue The value to set.
 */
function setObjectProperty(obj: object, propertyName: string, descriptor: Descriptor, jsValue: unknown): void {
    gObjectSetProperty(getHandle(obj), propertyName, toValue(descriptor, jsValue));
}

export { newObjectWithProperties, getObjectProperty, setObjectProperty };
