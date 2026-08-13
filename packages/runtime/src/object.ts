import { type Descriptor, type ExternalObject, type Handle, newObject } from "@gtkx/native";
import { type AnyClass, getParentClass } from "@gtkx/utils";
import { bind } from "./bind.js";
import { objectT, stringT, voidT } from "./descriptors.js";
import { LIB, VALUE_T } from "./library.js";
import { type ConstructProperty, constructPropertyFor } from "./properties.js";
import { getHandle, registerWrapper } from "./registry.js";
import { fromValue, newValueForDescriptor, toValue } from "./value.js";

/**
 * One construct property a wrapper class accepts: the canonical `GObject` name it is set under,
 * and the descriptor its value is marshalled through.
 */
type ConstructBinding = [name: string, descriptor: Descriptor];
/** The construct properties a wrapper class accepts, keyed by the camelCased name callers give them. */
type ConstructBindings = Record<string, ConstructBinding>;
type ResolvedBindings = { generation: number; bindings: ConstructBindings };

const declaredBindings: WeakMap<AnyClass, ConstructBindings> = new WeakMap();
const resolvedBindings: WeakMap<AnyClass, ResolvedBindings> = new WeakMap();
const declarations = { generation: 0 };
const NO_BINDINGS: ConstructBindings = Object.create(null) as ConstructBindings;

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

function collectDeclaredBindings(cls: AnyClass): ConstructBindings[] {
    const declared: ConstructBindings[] = [];
    let current: AnyClass | null = cls;

    while (current !== null) {
        const own = declaredBindings.get(current);

        if (own !== undefined) {
            declared.push(own);
        }

        current = getParentClass(current);
    }

    return declared;
}

function mergeDeclaredBindings(cls: AnyClass): ConstructBindings {
    const declared = collectDeclaredBindings(cls);
    const merged: ConstructBindings = Object.create(null) as ConstructBindings;

    for (let index = declared.length - 1; index >= 0; index--) {
        Object.assign(merged, declared[index]);
    }

    return merged;
}

function constructBindingsFor(cls: AnyClass | undefined): ConstructBindings {
    if (cls === undefined) {
        return NO_BINDINGS;
    }

    const cached = resolvedBindings.get(cls);

    if (cached?.generation === declarations.generation) {
        return cached.bindings;
    }

    const bindings = mergeDeclaredBindings(cls);
    resolvedBindings.set(cls, { generation: declarations.generation, bindings });

    return bindings;
}

/**
 * Declares the construct properties a wrapper class accepts, so `newObjectWithProperties`
 * marshals each one through its descriptor rather than resolving it from the
 * `GObject.ParamSpec` the type installs. A class inherits the declarations of its ancestors.
 * Registering takes effect immediately, including for classes already constructed from and for
 * subclasses that already inherited an earlier declaration.
 *
 * @param cls The wrapper class the properties are declared on.
 * @param bindings CamelCased property names mapped to their canonical name and descriptor.
 */
function registerConstructProperties(cls: AnyClass, bindings: ConstructBindings): void {
    declaredBindings.set(cls, bindings);
    declarations.generation += 1;
}

function constructPropertyForEntry(
    source: { gtype: bigint; bindings: ConstructBindings; wrapper: object },
    name: string,
    value: unknown,
): ConstructProperty | undefined {
    if (value === undefined) {
        return undefined;
    }

    const binding = source.bindings[name];

    if (binding === undefined) {
        return constructPropertyFor(source.gtype, name, value, source.wrapper);
    }

    return { name: binding[0], value: toValue(binding[1], value) };
}

/**
 * Constructs a new GObject of the given type, setting the supplied construct
 * properties, and binds `wrapper` to it. A property the wrapper's class declares
 * through `registerConstructProperties` is marshalled through its descriptor; any
 * other one is marshalled through the `GObject.ParamSpec` the type installs under
 * that name, dashed or camelCased, and is skipped when the type installs none.
 * A value that ParamSpec would refuse throws before GObject sees it: a `TypeError`
 * for a read-only property and for a value of a type the property cannot hold, and
 * a `RangeError` for a value the ParamSpec rejects. A value marshalled through a
 * declared descriptor is converted rather than checked, so a `null` handed to a
 * numeric one of those lands 0 rather than being refused.
 * Properties whose value is `undefined` are skipped. A type registered with
 * `registerClass` binds the wrapper before its `constructed` slot runs, so an
 * override of that slot already sees a usable instance.
 *
 * @param gtype The GType of the object to construct.
 * @param props Property names mapped to the values to set them to.
 * @param wrapper The wrapper instance to bind to the new object.
 * @returns The handle of the newly created object.
 */
function newObjectWithProperties(gtype: bigint, props: object, wrapper: object): ExternalObject<Handle> {
    const names: string[] = [];
    const values: ExternalObject<Handle>[] = [];
    const bindings = constructBindingsFor(wrapper.constructor as AnyClass | undefined);
    const source = { gtype, bindings, wrapper };

    for (const name of Object.keys(props)) {
        const property = constructPropertyForEntry(source, name, Reflect.get(props, name));

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
 * using the descriptor. The descriptor converts what it is given rather than checking it against
 * the property's `GObject.ParamSpec`, so `null` and `undefined` written to a numeric or enum
 * property land 0, where the same write to a property installed through `registerClass` is
 * refused with a `TypeError`.
 *
 * @param obj The object to write to.
 * @param propertyName The property name.
 * @param descriptor Describes the property's type.
 * @param jsValue The value to set.
 */
function setObjectProperty(obj: object, propertyName: string, descriptor: Descriptor, jsValue: unknown): void {
    gObjectSetProperty(getHandle(obj), propertyName, toValue(descriptor, jsValue));
}

export {
    newObjectWithProperties,
    getObjectProperty,
    registerConstructProperties,
    setObjectProperty,
    type ConstructBinding,
    type ConstructBindings,
};
