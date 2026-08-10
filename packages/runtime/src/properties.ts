import type { ExternalObject, Handle, RegisterClassProperty } from "@gtkx/native";
import type { AnyClass } from "@gtkx/utils";
import { camelCase, kebabCase } from "@gtkx/utils";
import { bind } from "./bind.js";
import { biguint64T, stringT, structT, voidT } from "./descriptors.js";
import { LIB, PARAM_T, VALUE_T } from "./library.js";
import {
    getParamFlags,
    getParamValueType,
    isParamConstructOnly,
    isParamLaxlyValidated,
    isParamWritable,
    type ValueGuard,
    valueGuardFor,
    wasParamValueModified,
} from "./param-spec.js";
import { getHandle, getInterfaceProperties, instanceClassName, type InterfaceProperty } from "./registry.js";
import { typeName } from "./type.js";
import { fromValue, intoValue, newValueForType, type ValueWriter, valueWriterFor } from "./value.js";

type PropertyCheck = {
    name: string;
    propertyName: string;
    handle: ExternalObject<Handle>;
    flags: number;
    valueType: bigint;
    canHoldValue: ValueGuard;
    write?: ValueWriter;
    scratch?: ExternalObject<Handle>;
};

type PropertyAccessor = PropertyCheck & {
    memberName: string;
    storage: symbol;
    hasGeneratedMember: boolean;
    isInterfaceProperty?: boolean;
    delegate?: InterfaceProperty;
};

/** A `GObject.ParamSpec` wrapper describing one property's name, type, flags and default. */
type PropertySpec = object;

type PropertyDispatch = {
    accessors: PropertyAccessor[];
    delegates: Map<string, InterfaceProperty>;
};

type PropertyDispatchSource = {
    klass: AnyClass;
    properties: Record<string, PropertySpec>;
    adoptedTypes: bigint[];
};

type ConstructProperty = {
    name: string;
    value: ExternalObject<Handle>;
};

type NotifyingObject = { notify?: (propertyName: string) => void };

const FIRST_PROPERTY_ID = 1;
const GET_PROPERTY_VFUNC = "vfuncGetProperty";
const SET_PROPERTY_VFUNC = "vfuncSetProperty";
const READ_ONLY_REASON = "the property is read-only";
const CONSTRUCT_ONLY_REASON = "the property can only be set when the object is constructed";
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
const typeLabel = (type: bigint): string => typeName(type) ?? String(type);

const defaultValueFor = (handle: ExternalObject<Handle>): ExternalObject<Handle> =>
    paramSpecDefaultValue(handle) as ExternalObject<Handle>;

const holdsReason = (check: PropertyCheck): string =>
    `the property holds values of type '${typeLabel(check.valueType)}'`;

function checkFor(handle: ExternalObject<Handle>, name: string): PropertyCheck {
    const valueType = getParamValueType(handle);

    return {
        name,
        propertyName: paramSpecName(handle) as string,
        handle,
        flags: getParamFlags(handle),
        valueType,
        canHoldValue: valueGuardFor(valueType),
    };
}

function findPropertySpec(klass: ExternalObject<Handle>, name: string): ExternalObject<Handle> | null {
    const found = classFindProperty(klass, name) as ExternalObject<Handle> | null;

    return found ?? (classFindProperty(klass, canonicalCase(name)) as ExternalObject<Handle> | null);
}

function describeValue(value: unknown): string {
    if (typeof value === "string") {
        return JSON.stringify(value);
    }

    if (typeof value === "object" && value !== null) {
        return instanceClassName(value);
    }

    return String(value);
}

function propertyMessage(instance: object, check: PropertyCheck, tail: string): string {
    return `${instanceClassName(instance)}.${check.name}: ${tail}`;
}

function refusalTail(check: PropertyCheck, value: unknown, reason: string): string {
    return `cannot set property '${check.propertyName}' to ${describeValue(value)}; ${reason}`;
}

function serveTail(check: PropertyCheck, value: unknown): string {
    return `cannot serve property '${check.propertyName}' from ${describeValue(value)}; ${holdsReason(check)}`;
}

function assertValueFits(instance: object, check: PropertyCheck, value: unknown): void {
    if (check.canHoldValue(value)) {
        return;
    }

    const tail = refusalTail(check, value, holdsReason(check));
    throw new TypeError(propertyMessage(instance, check, tail));
}

function assertValueServes(instance: object, check: PropertyCheck, value: unknown): void {
    if (check.canHoldValue(value)) {
        return;
    }

    throw new TypeError(propertyMessage(instance, check, serveTail(check, value)));
}

function assertValueValidates(
    instance: object,
    check: PropertyCheck,
    value: unknown,
    gValue: ExternalObject<Handle>,
): void {
    if (!wasParamValueModified(check.handle, gValue) || isParamLaxlyValidated(check.flags)) {
        return;
    }

    const reason =
        `the value is invalid or out of range for type '${typeLabel(check.valueType)}', ` +
        `and GObject would put ${describeValue(fromValue(gValue))} in its place`;

    throw new RangeError(propertyMessage(instance, check, refusalTail(check, value, reason)));
}

function assertWritable(instance: object, check: PropertyCheck, value: unknown): void {
    if (isParamWritable(check.flags)) {
        return;
    }

    throw new TypeError(propertyMessage(instance, check, refusalTail(check, value, READ_ONLY_REASON)));
}

function fillCheckedValue(
    instance: object,
    check: PropertyCheck,
    gValue: ExternalObject<Handle>,
    value: unknown,
): void {
    assertValueFits(instance, check, value);
    check.write ??= valueWriterFor(check.valueType);
    check.write(gValue, value);
    assertValueValidates(instance, check, value, gValue);
}

function checkedValueFor(instance: object, check: PropertyCheck, value: unknown): ExternalObject<Handle> {
    const gValue = newValueForType(check.valueType);
    fillCheckedValue(instance, check, gValue, value);

    return gValue;
}

function assertValueAccepted(instance: object, check: PropertyCheck, value: unknown): void {
    check.scratch ??= newValueForType(check.valueType);
    fillCheckedValue(instance, check, check.scratch, value);
}

function constructValueFor(wrapper: object, check: PropertyCheck, value: unknown): ConstructProperty {
    assertWritable(wrapper, check, value);

    return { name: check.propertyName, value: checkedValueFor(wrapper, check, value) };
}

function constructPropertyFor(
    gtype: bigint,
    name: string,
    value: unknown,
    wrapper: object,
): ConstructProperty | undefined {
    const klass = typeClassRef(gtype) as ExternalObject<Handle>;

    try {
        const pspec = findPropertySpec(klass, name);

        return pspec === null ? undefined : constructValueFor(wrapper, checkFor(pspec, name), value);
    } finally {
        typeClassUnref(klass);
    }
}

function readStored(instance: Record<symbol, unknown>, accessor: PropertyAccessor): unknown {
    if (!Object.hasOwn(instance, accessor.storage)) {
        instance[accessor.storage] = fromValue(defaultValueFor(accessor.handle));
    }

    return instance[accessor.storage];
}

function storeValue(instance: Record<symbol, unknown>, accessor: PropertyAccessor, value: unknown): void {
    instance[accessor.storage] = value;
}

function writeStored(instance: Record<symbol, unknown>, accessor: PropertyAccessor, value: unknown): void {
    if (readStored(instance, accessor) === value) {
        return;
    }

    storeValue(instance, accessor, value);
    (instance as NotifyingObject).notify?.(accessor.propertyName);
}

function writeProperty(instance: object, accessor: PropertyAccessor, value: unknown): void {
    const stored = instance as Record<symbol, unknown>;

    if (readStored(stored, accessor) === value) {
        return;
    }

    assertValueAccepted(instance, accessor, value);
    storeValue(stored, accessor, value);
    (instance as NotifyingObject).notify?.(accessor.propertyName);
}

function storedGetter(accessor: PropertyAccessor): (this: object) => unknown {
    return function get(this: object) {
        return readStored(this as Record<symbol, unknown>, accessor);
    };
}

function memberGetter(accessor: PropertyAccessor): (this: object) => unknown {
    return function get(this: object) {
        return (this as Record<string, unknown>)[accessor.memberName];
    };
}

function memberSetter(accessor: PropertyAccessor): (this: object, value: unknown) => void {
    return function set(this: object, value: unknown) {
        (this as Record<string, unknown>)[accessor.memberName] = value;
    };
}

function refusalFor(accessor: PropertyAccessor, reason: string): (this: object, value: unknown) => void {
    return function set(this: object, value: unknown) {
        throw new TypeError(propertyMessage(this, accessor, refusalTail(accessor, value, reason)));
    };
}

function checkedSetter(accessor: PropertyAccessor): (this: object, value: unknown) => void {
    if (!isParamWritable(accessor.flags)) {
        return refusalFor(accessor, READ_ONLY_REASON);
    }

    if (isParamConstructOnly(accessor.flags)) {
        return refusalFor(accessor, CONSTRUCT_ONLY_REASON);
    }

    return function set(this: object, value: unknown) {
        writeProperty(this, accessor, value);
    };
}

function hasOwnMember(prototype: object, alias: string): boolean {
    return Object.getOwnPropertyDescriptor(prototype, alias) !== undefined;
}

function defineAccessor(prototype: object, descriptor: PropertyDescriptor, alias: string): void {
    if (hasOwnMember(prototype, alias)) {
        return;
    }

    Object.defineProperty(prototype, alias, descriptor);
}

function installAccessors(klass: AnyClass, accessor: PropertyAccessor): void {
    const prototype = (klass as { prototype: object }).prototype;
    accessor.hasGeneratedMember = !hasOwnMember(prototype, accessor.memberName);

    const descriptor: PropertyDescriptor = {
        configurable: true,
        enumerable: true,
        get: accessor.hasGeneratedMember ? storedGetter(accessor) : memberGetter(accessor),
        set: accessor.hasGeneratedMember ? checkedSetter(accessor) : memberSetter(accessor),
    };

    for (const alias of accessorNames(accessor.name)) {
        defineAccessor(prototype, descriptor, alias);
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
    const handle = getHandle(pspec);
    const propertyName = paramSpecName(handle) as string;
    const delegate = dispatch.delegates.get(propertyName);

    const accessor: PropertyAccessor = {
        ...checkFor(handle, propertyName),
        memberName: camelCase(propertyName),
        storage: storageFor(propertyName),
        hasGeneratedMember: false,
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

function backingMemberFor(instance: object, accessor: PropertyAccessor): string | undefined {
    if (accessor.hasGeneratedMember && !Object.hasOwn(instance, accessor.memberName)) {
        return undefined;
    }

    return accessor.memberName;
}

function readCurrent(instance: object, accessor: PropertyAccessor): unknown {
    const getter = accessor.delegate?.getter;

    if (getter !== undefined) {
        return callMember(instance, getter, []);
    }

    if (accessor.isInterfaceProperty === true) {
        return readStored(instance as Record<symbol, unknown>, accessor);
    }

    const member = backingMemberFor(instance, accessor);

    return member === undefined
        ? readStored(instance as Record<symbol, unknown>, accessor)
        : (instance as Record<string, unknown>)[member];
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

    const member = backingMemberFor(instance, accessor);

    if (member === undefined) {
        storeValue(instance as Record<symbol, unknown>, accessor, value);

        return;
    }

    (instance as Record<string, unknown>)[member] = value;
}

function makeGetProperty(dispatch: PropertyDispatch) {
    return function getProperty(this: object, propertyId: number, value: object, pspec: PropertySpec): void {
        const accessor = resolveAccessor(dispatch, propertyId, pspec);
        const current = readCurrent(this, accessor);
        assertValueServes(this, accessor, current);
        intoValue(getHandle(value), current);
    };
}

function makeSetProperty(dispatch: PropertyDispatch) {
    return function setProperty(this: object, propertyId: number, value: object, pspec: PropertySpec): void {
        const accessor = resolveAccessor(dispatch, propertyId, pspec);
        writeCurrent(this, accessor, fromValue(getHandle(value)));
    };
}

function assertCanonicalName(klass: AnyClass, name: string, propertyName: string): void {
    const canonical = canonicalCase(name);

    if (propertyName === canonical) {
        return;
    }

    throw new TypeError(
        `registerClass: ${klass.name} keys the property '${name}' to a GObject.ParamSpec named ` +
        `'${propertyName}', which is the name GObject notifies under; name the ParamSpec '${canonical}'`,
    );
}

function assertCanonicalNames(klass: AnyClass, properties: Record<string, PropertySpec>): void {
    for (const [name, pspec] of Object.entries(properties)) {
        assertCanonicalName(klass, name, getPropertyName(pspec));
    }
}

function buildAccessor(klass: AnyClass, name: string, pspec: PropertySpec): PropertyAccessor {
    const accessor: PropertyAccessor = {
        ...checkFor(getHandle(pspec), name),
        memberName: camelCase(name),
        storage: Symbol(`gtkx:property:${name}`),
        hasGeneratedMember: false,
    };

    installAccessors(klass, accessor);

    return accessor;
}

function buildAccessors(source: PropertyDispatchSource): PropertyAccessor[] {
    const { klass, properties } = source;
    assertCanonicalNames(klass, properties);

    return Object.entries(properties).map(([name, pspec]) => buildAccessor(klass, name, pspec));
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

function buildPropertyDispatch(source: PropertyDispatchSource): PropertyDispatch {
    return {
        accessors: buildAccessors(source),
        delegates: interfaceDelegatesFor(source.adoptedTypes),
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
    GET_PROPERTY_VFUNC,
    makeGetProperty,
    makeSetProperty,
    SET_PROPERTY_VFUNC,
    toNativeProperties,
    type ConstructProperty,
    type PropertyDispatch,
    type PropertySpec,
};
