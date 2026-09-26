import { type ExternalObject, type Handle, newObject } from "@gtkx/native";
import { type AnyClass, getParentClass } from "@gtkx/utils";
import type { Descriptor } from "./descriptor-types.js";
import type { ReadableProperties, WritableProperties } from "./property-types.js";
import { bind } from "./bind.js";
import { objectT, stringT, voidT } from "./descriptors.js";
import { LIB, VALUE_T } from "./library.js";
import {
    coerceConstructPropertyValue,
    type ConstructProperty,
    constructPropertyFor,
    readableObjectPropertyFor,
    writableObjectPropertyFor,
} from "./properties.js";
import { propertyWriteComplete } from "./property-brand.js";
import { getHandle, registerWrapper } from "./registry.js";
import { TYPE_OBJECT, typeIsA } from "./type.js";
import { fromObjectPropertyValue, fromValueForDescriptor, newValueForDescriptor, toValue } from "./value.js";

/**
 * One construct property a wrapper class accepts: the canonical `GObject` name it is set under,
 * and the descriptor its value is marshalled through.
 */
type ConstructBinding = [name: string, descriptor: Descriptor];
/** The construct properties a wrapper class accepts, keyed by the camelCased name callers give them. */
type ConstructBindings = Record<string, ConstructBinding>;
type ResolvedBindings = { generation: number; bindings: ConstructBindings };

const constructFactories: WeakMap<object, () => object> = new WeakMap();
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

function registerConstructFactory<T extends object>(cls: AnyClass<T>, factory: () => T): void {
    constructFactories.set(cls, factory);
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

    return {
        name: binding[0],
        value: toValue(binding[1], coerceConstructPropertyValue(source.gtype, binding[0], value)),
    };
}

/**
 * Constructs a GObject with the supplied properties and binds its JavaScript wrapper.
 *
 * @remarks
 * Properties declared through `registerConstructProperties` use their descriptors. Other
 * properties use the type's `GObject.ParamSpec`, accepting dashed or camelCased names. Unknown
 * properties and `undefined` values are skipped.
 *
 * For types created with `registerClass`, the wrapper is bound before `constructed` runs. If
 * construction has already exposed the object to JavaScript, its existing wrapper is reused
 * instead, preserving identity.
 *
 * @param gtype GType to construct.
 * @param props Construct property names and values.
 * @param wrapper Wrapper to bind unless the object already has one.
 * @returns The supplied wrapper or the object's existing wrapper.
 * @throws {TypeError} When a ParamSpec-backed property is read-only or cannot hold the value's type.
 * @throws {RangeError} When a ParamSpec rejects the value.
 */
function newObjectWithProperties<T extends object>(gtype: bigint, props: object, wrapper: T): T {
    if (!typeIsA(gtype, TYPE_OBJECT)) {
        throw new TypeError("Object construction requires a GObject type");
    }

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

    const existing = constructFactories.get(wrapper.constructor)?.() ??
        newObject(gtype, names, values, wrapper, registerWrapper);

    if (existing !== null) {
        return existing as T;
    }

    return wrapper;
}

/**
 * Reads a GObject property and converts it to its JavaScript value using the
 * descriptor.
 *
 * @param obj The object to read from.
 * @param propertyName The property name.
 * @param descriptor Describes the property's type.
 */
function getProperty<
    TObject extends { __properties__: object },
    TPropertyMap extends object = Extract<ReadableProperties<TObject>, object>,
    TName extends Extract<keyof NoInfer<TPropertyMap>, string> = Extract<keyof NoInfer<TPropertyMap>, string>,
>(obj: TObject, propertyName: TName): NoInfer<TPropertyMap>[TName];
function getProperty(obj: object, propertyName: string, descriptor: Descriptor): unknown;
function getProperty(obj: object, propertyName: string, descriptor?: Descriptor): unknown {
    if (arguments.length === 2) {
        return getObjectProperty(obj, propertyName);
    }

    if (descriptor === undefined) {
        throw new TypeError("getProperty requires a property descriptor when called with three arguments");
    }

    const value = newValueForDescriptor(descriptor);
    gObjectGetProperty(getHandle(obj), propertyName, value);

    return fromValueForDescriptor(descriptor, value);
}

function getObjectProperty(obj: object, propertyName: string): unknown {
    const property = readableObjectPropertyFor(obj, propertyName);
    gObjectGetProperty(getHandle(obj), property.name, property.value);

    return fromObjectPropertyValue(property.value);
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
function setProperty<
    TObject extends { __writableProperties__: object },
    TPropertyMap extends object = Extract<WritableProperties<TObject>, object>,
    TName extends Extract<keyof NoInfer<TPropertyMap>, string> = Extract<keyof NoInfer<TPropertyMap>, string>,
>(obj: TObject, propertyName: TName, jsValue: NoInfer<TPropertyMap>[TName]): void;
function setProperty(obj: object, propertyName: string, descriptor: Descriptor, jsValue: unknown): void;
function setProperty(
    obj: object,
    propertyName: string,
    descriptorOrValue: unknown,
    jsValue?: unknown,
): void {
    if (arguments.length === 3) {
        const property = writableObjectPropertyFor(obj, propertyName, descriptorOrValue);
        gObjectSetProperty(getHandle(obj), property.name, property.value);
    } else {
        gObjectSetProperty(getHandle(obj), propertyName, toValue(descriptorOrValue as Descriptor, jsValue));
    }

    (obj as { [propertyWriteComplete]?: (name: string) => void })[propertyWriteComplete]?.(propertyName);
}

export {
    newObjectWithProperties,
    getObjectProperty,
    getProperty,
    registerConstructProperties,
    registerConstructFactory,
    setProperty,
    type ConstructBinding,
    type ConstructBindings,
};
