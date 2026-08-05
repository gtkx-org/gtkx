import { type Descriptor, type ExternalObject, type Handle, newObject } from "@gtkx/native";
import { bind } from "./bind.js";
import { objectT, stringT, voidT } from "./descriptors.js";
import { LIB, VALUE_T } from "./library.js";
import { type ConstructProperty, constructPropertyFor } from "./properties.js";
import { getHandle, registerWrapper } from "./registry.js";
import { fromValue, newValueForDescriptor, toValue } from "./value.js";

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

const isDescribedEntry = (entry: unknown): entry is [Descriptor, unknown] =>
    Array.isArray(entry) && entry.length === 2 && typeof (entry[0] as Partial<Descriptor>).kind === "string";

function constructPropertyForEntry(gtype: bigint, name: string, entry: unknown): ConstructProperty | undefined {
    if (isDescribedEntry(entry)) {
        const [descriptor, value] = entry;

        return value === undefined ? undefined : { name, value: toValue(descriptor, value) };
    }

    return entry === undefined ? undefined : constructPropertyFor(gtype, name, entry);
}

/**
 * Constructs a new GObject of the given type, setting the supplied construct
 * properties, and binds `wrapper` to it. An entry carrying a `[descriptor, value]`
 * pair is marshalled through the descriptor; any other entry is marshalled through
 * the `GObject.ParamSpec` the type installs under that name, dashed or camelCased,
 * and is skipped when the type installs none. Entries whose value is `undefined` are
 * skipped. A type registered with `registerClass` binds the wrapper before its
 * `constructed` slot runs, so an override of that slot already sees a usable instance.
 *
 * @param gtype The GType of the object to construct.
 * @param props Property names mapped to `[descriptor, value]` pairs or to plain values.
 * @param wrapper The wrapper instance to bind to the new object.
 * @returns The handle of the newly created object.
 */
function newObjectWithProperties(
    gtype: bigint,
    props: Record<string, unknown>,
    wrapper: object,
): ExternalObject<Handle> {
    const names: string[] = [];
    const values: ExternalObject<Handle>[] = [];

    for (const name in props) {
        const property = constructPropertyForEntry(gtype, name, props[name]);

        if (property !== undefined) {
            names.push(property.name);
            values.push(property.value);
        }
    }

    newObject(gtype, names, values, wrapper, registerWrapper);

    return getHandle(wrapper);
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
