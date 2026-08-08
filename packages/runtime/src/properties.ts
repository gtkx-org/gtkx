import type { ExternalObject, Handle, RegisterClassProperty } from "@gtkx/native";
import type { AnyClass } from "@gtkx/utils";
import { camelCase, kebabCase } from "@gtkx/utils";
import { bind } from "./bind.js";
import { biguint64T, stringT, structT, voidT } from "./descriptors.js";
import { LIB, PARAM_T, VALUE_T } from "./library.js";
import { getHandle, getInterfaceProperties, instanceClassName, type InterfaceProperty } from "./registry.js";
import { fromValue, getValueType, intoValue, newValueForType } from "./value.js";

type PropertyAccessor = {
    name: string;
    propertyName: string;
    storage: symbol;
    pspec: object;
    isInterfaceProperty?: boolean;
    delegate?: InterfaceProperty;
};

/** A `GObject.ParamSpec` wrapper describing one property's name, type, flags and default. */
type PropertySpec = object;

type PropertyDispatch = {
    accessors: PropertyAccessor[];
    delegates: Map<string, InterfaceProperty>;
};

type ConstructProperty = {
    name: string;
    value: ExternalObject<Handle>;
};

type InstalledProperty = {
    name: string;
    type: bigint;
};

type NotifyingObject = { notify?: (propertyName: string) => void };

const FIRST_PROPERTY_ID = 1;
const CLASS_T = structT("borrowed");
const interfaceStorages: Map<string, symbol> = new Map();
const paramSpecDefaultValue = bind(LIB, "g_param_spec_get_default_value", [PARAM_T], VALUE_T);
const paramSpecName = bind(LIB, "g_param_spec_get_name", [PARAM_T], stringT("borrowed"));
const typeClassRef = bind(LIB, "g_type_class_ref", [biguint64T], CLASS_T);
const typeClassUnref = bind(LIB, "g_type_class_unref", [CLASS_T], voidT);
const classFindProperty = bind(LIB, "g_object_class_find_property", [CLASS_T, stringT("borrowed")], PARAM_T);

const getPropertyName = (pspec: PropertySpec): string => paramSpecName(getHandle(pspec)) as string;
const underscoreCase = (name: string): string => name.replaceAll("-", "_");
const canonicalCase = (name: string): string => kebabCase(name).replaceAll("_", "-");
const accessorNames = (name: string): string[] => [...new Set([name, underscoreCase(name), camelCase(name)])];

function findPropertySpec(klass: ExternalObject<Handle>, name: string): ExternalObject<Handle> | null {
    const found = classFindProperty(klass, name) as ExternalObject<Handle> | null;

    return found ?? (classFindProperty(klass, canonicalCase(name)) as ExternalObject<Handle> | null);
}

function readInstalledProperty(pspec: ExternalObject<Handle>): InstalledProperty {
    const defaults = paramSpecDefaultValue(pspec) as ExternalObject<Handle>;

    return { name: paramSpecName(pspec) as string, type: getValueType(defaults) };
}

function findInstalledProperty(gtype: bigint, name: string): InstalledProperty | undefined {
    const klass = typeClassRef(gtype) as ExternalObject<Handle>;

    try {
        const pspec = findPropertySpec(klass, name);

        return pspec === null ? undefined : readInstalledProperty(pspec);
    } finally {
        typeClassUnref(klass);
    }
}

function constructPropertyFor(gtype: bigint, name: string, jsValue: unknown): ConstructProperty | undefined {
    const installed = findInstalledProperty(gtype, name);

    if (installed === undefined) {
        return undefined;
    }

    const value = newValueForType(installed.type);
    intoValue(value, jsValue);

    return { name: installed.name, value };
}

function readStored(instance: Record<symbol, unknown>, accessor: PropertyAccessor): unknown {
    if (!Object.hasOwn(instance, accessor.storage)) {
        const defaults = paramSpecDefaultValue(getHandle(accessor.pspec)) as ExternalObject<Handle>;
        instance[accessor.storage] = fromValue(defaults);
    }

    return instance[accessor.storage];
}

function writeStored(instance: Record<symbol, unknown>, accessor: PropertyAccessor, value: unknown): void {
    if (readStored(instance, accessor) === value) {
        return;
    }

    instance[accessor.storage] = value;
    (instance as NotifyingObject).notify?.(accessor.propertyName);
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
            writeStored(this, accessor, value);
        },
    });
}

function installAccessors(klass: AnyClass, accessor: PropertyAccessor): void {
    const prototype = (klass as { prototype: object }).prototype;

    for (const alias of accessorNames(accessor.name)) {
        defineAccessor(prototype, accessor, alias);
    }
}

function storageFor(propertyName: string): symbol {
    const existing = interfaceStorages.get(propertyName);

    if (existing !== undefined) {
        return existing;
    }

    const created = Symbol(`gtkx:property:${propertyName}`);
    interfaceStorages.set(propertyName, created);

    return created;
}

function interfaceAccessorFor(dispatch: PropertyDispatch, pspec: PropertySpec): PropertyAccessor {
    const propertyName = getPropertyName(pspec);
    const delegate = dispatch.delegates.get(propertyName);

    const accessor: PropertyAccessor = {
        name: propertyName,
        propertyName,
        storage: storageFor(propertyName),
        pspec,
        isInterfaceProperty: true,
    };

    if (delegate !== undefined) {
        accessor.delegate = delegate;
    }

    return accessor;
}

function resolveAccessor(
    dispatch: PropertyDispatch,
    propertyId: number,
    pspec: PropertySpec,
): PropertyAccessor {
    const accessor = dispatch.accessors[propertyId - FIRST_PROPERTY_ID];

    if (accessor !== undefined) {
        return accessor;
    }

    const created = interfaceAccessorFor(dispatch, pspec);
    dispatch.accessors[propertyId - FIRST_PROPERTY_ID] = created;

    return created;
}

function callMember(instance: object, member: string, args: unknown[]): unknown {
    const fn: unknown = (instance as Record<string, unknown>)[member];

    if (typeof fn !== "function") {
        throw new TypeError(`registerClass: ${instanceClassName(instance)} has no '${member}' member`);
    }

    return (fn as (...values: unknown[]) => unknown).apply(instance, args);
}

function readCurrent(instance: object, accessor: PropertyAccessor): unknown {
    const getter = accessor.delegate?.getter;

    if (getter !== undefined) {
        return callMember(instance, getter, []);
    }

    if (accessor.isInterfaceProperty === true) {
        return readStored(instance as Record<symbol, unknown>, accessor);
    }

    return (instance as Record<string, unknown>)[camelCase(accessor.name)];
}

function writeCurrent(instance: object, accessor: PropertyAccessor, value: unknown): void {
    const setter = accessor.delegate?.setter;

    if (setter !== undefined) {
        callMember(instance, setter, [value]);

        return;
    }

    if (accessor.isInterfaceProperty === true) {
        writeStored(instance as Record<symbol, unknown>, accessor, value);

        return;
    }

    (instance as Record<string, unknown>)[camelCase(accessor.name)] = value;
}

function makeGetProperty(dispatch: PropertyDispatch) {
    return function getProperty(this: object, propertyId: number, value: object, pspec: PropertySpec): void {
        const accessor = resolveAccessor(dispatch, propertyId, pspec);
        intoValue(getHandle(value), readCurrent(this, accessor));
    };
}

function makeSetProperty(dispatch: PropertyDispatch) {
    return function setProperty(this: object, propertyId: number, value: object, pspec: PropertySpec): void {
        const accessor = resolveAccessor(dispatch, propertyId, pspec);
        writeCurrent(this, accessor, fromValue(getHandle(value)));
    };
}

function buildAccessors(klass: AnyClass, properties: Record<string, PropertySpec>): PropertyAccessor[] {
    const accessors: PropertyAccessor[] = [];

    for (const [name, pspec] of Object.entries(properties)) {
        const accessor: PropertyAccessor = {
            name,
            propertyName: getPropertyName(pspec),
            storage: Symbol(`gtkx:property:${name}`),
            pspec,
        };

        installAccessors(klass, accessor);
        accessors.push(accessor);
    }

    return accessors;
}

function addInterfaceDelegates(delegates: Map<string, InterfaceProperty>, gtype: bigint): void {
    const properties = getInterfaceProperties(gtype) ?? {};

    for (const [name, delegate] of Object.entries(properties)) {
        if (!delegates.has(name)) {
            delegates.set(name, delegate);
        }
    }
}

function interfaceDelegatesFor(adoptedTypes: bigint[]): Map<string, InterfaceProperty> {
    const delegates: Map<string, InterfaceProperty> = new Map();

    for (const gtype of adoptedTypes) {
        addInterfaceDelegates(delegates, gtype);
    }

    return delegates;
}

function buildPropertyDispatch(
    klass: AnyClass,
    properties: Record<string, PropertySpec>,
    adoptedTypes: bigint[],
): PropertyDispatch {
    return {
        accessors: buildAccessors(klass, properties),
        delegates: interfaceDelegatesFor(adoptedTypes),
    };
}

function toNativeProperties(properties: Record<string, PropertySpec>): RegisterClassProperty[] {
    return Object.values(properties).map((pspec, index) => ({
        id: index + FIRST_PROPERTY_ID,
        pspec: getHandle(pspec),
    }));
}

export {
    buildPropertyDispatch,
    constructPropertyFor,
    makeGetProperty,
    makeSetProperty,
    toNativeProperties,
    type ConstructProperty,
    type PropertyDispatch,
    type PropertySpec,
};
