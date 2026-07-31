import type { ExternalObject, Handle, RegisterClassProperty } from "@gtkx/native";
import type { AnyClass } from "@gtkx/utils";
import { camelCase } from "@gtkx/utils";
import { bind } from "./bind.js";
import { LIB, PARAM_T, VALUE_T } from "./library.js";
import { getHandle } from "./registry.js";
import { fromValue, intoValue } from "./value.js";

type PropertyAccessor = {
    name: string;
    storage: symbol;
    pspec: object;
};

/** A `GObject.ParamSpec` wrapper describing one property's name, type, flags and default. */
type PropertySpec = object;
type NotifyingObject = { notify?: (propertyName: string) => void };

const FIRST_PROPERTY_ID = 1;
const paramSpecDefaultValue = bind(LIB, "g_param_spec_get_default_value", [PARAM_T], VALUE_T);

const underscoreCase = (name: string): string => name.replaceAll("-", "_");
const accessorNames = (name: string): string[] => [...new Set([name, underscoreCase(name), camelCase(name)])];

function readStored(instance: Record<symbol, unknown>, accessor: PropertyAccessor): unknown {
    if (!Object.hasOwn(instance, accessor.storage)) {
        const defaults = paramSpecDefaultValue(getHandle(accessor.pspec)) as ExternalObject<Handle>;
        instance[accessor.storage] = fromValue(defaults);
    }

    return instance[accessor.storage];
}

function defineAccessor(prototype: object, accessor: PropertyAccessor, alias: string): void {
    if (Object.getOwnPropertyDescriptor(prototype, alias) !== undefined) {
        return;
    }

    Object.defineProperty(prototype, alias, {
        configurable: true,
        enumerable: true,
        get(this: Record<symbol, unknown>) {
            return readStored(this, accessor);
        },
        set(this: Record<symbol, unknown>, value: unknown) {
            if (readStored(this, accessor) === value) {
                return;
            }

            this[accessor.storage] = value;
            (this as NotifyingObject).notify?.(accessor.name);
        },
    });
}

function installAccessors(klass: AnyClass, accessor: PropertyAccessor): void {
    const prototype = (klass as { prototype: object }).prototype;

    for (const alias of accessorNames(accessor.name)) {
        defineAccessor(prototype, accessor, alias);
    }
}

function resolveAccessor(accessors: PropertyAccessor[], propertyId: number): PropertyAccessor {
    const accessor = accessors[propertyId - FIRST_PROPERTY_ID];

    if (accessor === undefined) {
        throw new RangeError(`registerClass: no property registered for id ${String(propertyId)}`);
    }

    return accessor;
}

function makeGetProperty(accessors: PropertyAccessor[]) {
    return function getProperty(this: object, propertyId: number, value: object): void {
        const accessor = resolveAccessor(accessors, propertyId);
        const current = (this as Record<string, unknown>)[camelCase(accessor.name)];
        intoValue(getHandle(value), current);
    };
}

function makeSetProperty(accessors: PropertyAccessor[]) {
    return function setProperty(this: object, propertyId: number, value: object): void {
        const accessor = resolveAccessor(accessors, propertyId);
        const jsValue = fromValue(getHandle(value));
        (this as Record<string, unknown>)[camelCase(accessor.name)] = jsValue;
    };
}

function buildAccessors(klass: AnyClass, properties: Record<string, PropertySpec>): PropertyAccessor[] {
    const accessors: PropertyAccessor[] = [];

    for (const [name, pspec] of Object.entries(properties)) {
        const accessor: PropertyAccessor = { name, storage: Symbol(`gtkx:property:${name}`), pspec };
        installAccessors(klass, accessor);
        accessors.push(accessor);
    }

    return accessors;
}

function toNativeProperties(properties: Record<string, PropertySpec>): RegisterClassProperty[] {
    return Object.values(properties).map((pspec, index) => ({
        id: index + FIRST_PROPERTY_ID,
        pspec: getHandle(pspec),
    }));
}

export {
    buildAccessors,
    makeGetProperty,
    makeSetProperty,
    toNativeProperties,
    type PropertyAccessor,
    type PropertySpec,
};
