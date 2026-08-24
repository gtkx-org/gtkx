import type * as GObject from "@gtkx/gi/gobject";
import type { PropertyEntry } from "virtual:gtkx-config";
import {
    type AnyClass,
    getClassType,
    getDeclaredPropertyName,
    getWrapperClass,
    TYPE_INVALID,
    typeFromName,
    typeInterfaces,
    typeName,
    typeParent,
} from "@gtkx/runtime";
import { getObjectPropertyInfo } from "@gtkx/runtime/internal";
import { getOrInsert, kebabCase, unsanitizeIdentifier } from "@gtkx/utils";
import * as virtualMetadataExports from "virtual:gtkx-config";
import { deferredProps, type ElementBehavior, ELEMENTS, type Props } from "./registry.js";

type PropertyTable = Record<string, Record<string, PropertyEntry>>;

type VirtualMetadata = {
    constructOnlyProps?: Record<string, Set<string>> | undefined;
    constructProps?: Record<string, Set<string>> | undefined;
    defaultProps?: Record<string, Record<string, unknown>> | undefined;
    properties?: PropertyTable | undefined;
    signals: Record<string, Record<string, string>>;
    userEventSignals: Record<string, string[]>;
};

type LegacyMetadata = {
    constructOnlyProps: Record<string, Set<string>>;
    constructProps: Record<string, Set<string>>;
    defaultProps: Record<string, Record<string, unknown>>;
};

type TypeInfo = {
    typeName: string;
    properties: Record<string, PropertyEntry>;
    signals: Record<string, string>;
    userEventSignals: Set<string>;
    behaviors: ElementBehavior[];
    deferred: Set<string>;
    declaredConstructOnly: Set<string>;
    isLazy: boolean;
    hasFlush: boolean;
    constructOnly: Set<string>;
    construct: Set<string>;
    defaults: Record<string, unknown>;
    resolvedProperties: Set<string>;
};

const WRITABLE = 2;
const CONSTRUCT = 4;
const CONSTRUCT_ONLY = 8;
const NAME = 0;
const FLAGS = 1;
const DEFAULT_VALUE = 2;
const virtualMetadata: VirtualMetadata = { ...virtualMetadataExports };
const properties = virtualMetadata.properties ?? legacyProperties(virtualMetadata);
const isLegacyMetadata = virtualMetadata.properties === undefined;
const signals = virtualMetadata.signals;
const userEventSignals = virtualMetadata.userEventSignals;
const ancestryCache: Map<string, string[]> = new Map();
const typeInfoCache: Map<string, TypeInfo> = new Map();

function legacyPropertyFlags(accessor: string, constructOnly: Set<string>, construct: Set<string>): number {
    if (constructOnly.has(accessor)) {
        return CONSTRUCT_ONLY;
    }

    return construct.has(accessor) ? CONSTRUCT : 0;
}

function legacyPropertyEntry(
    accessor: string,
    constructOnly: Set<string>,
    construct: Set<string>,
    defaults: Record<string, unknown>,
): PropertyEntry {
    const flags = legacyPropertyFlags(accessor, constructOnly, construct);
    const name = unsanitizeIdentifier(kebabCase(accessor));

    return Object.hasOwn(defaults, accessor) ? [name, flags, defaults[accessor]] : [name, flags];
}

function requireLegacyMetadata(metadata: VirtualMetadata): LegacyMetadata {
    const { constructOnlyProps, constructProps, defaultProps } = metadata;

    if (constructOnlyProps === undefined) {
        throw new Error("The generated JSX metadata has neither the current nor the legacy property exports");
    }

    if (constructProps === undefined) {
        throw new Error("The generated JSX metadata has neither the current nor the legacy property exports");
    }

    if (defaultProps === undefined) {
        throw new Error("The generated JSX metadata has neither the current nor the legacy property exports");
    }

    return { constructOnlyProps, constructProps, defaultProps };
}

function legacyTypeProperties(metadata: LegacyMetadata, type: string): Record<string, PropertyEntry> {
    const constructOnly = metadata.constructOnlyProps[type] ?? new Set<string>();
    const construct = metadata.constructProps[type] ?? new Set<string>();
    const defaults = metadata.defaultProps[type] ?? {};
    const entries: Record<string, PropertyEntry> = {};
    const accessors = new Set([...constructOnly, ...construct, ...Object.keys(defaults)]);

    for (const accessor of accessors) {
        entries[accessor] = legacyPropertyEntry(accessor, constructOnly, construct, defaults);
    }

    return entries;
}

function legacyProperties(metadata: VirtualMetadata): PropertyTable {
    const legacy = requireLegacyMetadata(metadata);
    const properties: PropertyTable = {};

    const types = new Set([
        ...Object.keys(legacy.constructOnlyProps),
        ...Object.keys(legacy.constructProps),
        ...Object.keys(legacy.defaultProps),
    ]);

    for (const type of types) {
        properties[type] = legacyTypeProperties(legacy, type);
    }

    return properties;
}

const addAncestor = (names: string[], seen: Set<string>, name: string | null): void => {
    if (name === null || seen.has(name)) {
        return;
    }

    seen.add(name);
    names.push(name);
};

const buildAncestry = (name: string): string[] => {
    const names: string[] = [];
    const seen: Set<string> = new Set();
    let type = typeFromName(name);

    while (type !== TYPE_INVALID) {
        addAncestor(names, seen, typeName(type));

        for (const iface of typeInterfaces(type)) {
            addAncestor(names, seen, typeName(iface));
        }

        type = typeParent(type);
    }

    return names;
};

const ancestryFor = (name: string): string[] => getOrInsert(ancestryCache, name, buildAncestry);

const addAll = <T>(target: Set<T>, source: Iterable<T> | undefined): void => {
    const items = source ?? [];

    for (const item of items) {
        target.add(item);
    }
};

const accumulateAncestor = (info: TypeInfo, ancestor: string): void => {
    Object.assign(info.signals, signals[ancestor] ?? {});
    addAll(info.userEventSignals, userEventSignals[ancestor]);
    info.behaviors.push(...(ELEMENTS[ancestor]?.behaviors ?? []));
};

const resolveProperty = (info: TypeInfo, name: string, entry: PropertyEntry): void => {
    if ((entry[FLAGS] & CONSTRUCT_ONLY) !== 0) {
        info.constructOnly.add(name);
    }

    if ((entry[FLAGS] & (WRITABLE | CONSTRUCT | CONSTRUCT_ONLY)) !== 0) {
        info.construct.add(name);
    }

    if (entry.length > DEFAULT_VALUE) {
        info.defaults[name] = entry[DEFAULT_VALUE];
    }
};

const resolveProperties = (info: TypeInfo): void => {
    for (const [name, entry] of Object.entries(info.properties)) {
        resolveProperty(info, name, entry);
    }
};

const applyBehaviorFlags = (info: TypeInfo, behavior: ElementBehavior): void => {
    if (behavior.flush !== undefined) {
        info.hasFlush = true;
    }

    addAll(info.deferred, deferredProps(behavior));
    addAll(info.declaredConstructOnly, behavior.constructOnly);
};

const resolveBehaviorFlags = (info: TypeInfo): void => {
    for (const behavior of info.behaviors) {
        applyBehaviorFlags(info, behavior);
    }
};

const buildTypeInfo = (name: string): TypeInfo => {
    const chain = ancestryFor(name);

    const info: TypeInfo = {
        typeName: name,
        properties: {},
        signals: {},
        userEventSignals: new Set(),
        behaviors: [],
        deferred: new Set(),
        declaredConstructOnly: new Set(),
        isLazy: false,
        hasFlush: false,
        constructOnly: new Set(),
        construct: new Set(),
        defaults: {},
        resolvedProperties: new Set(),
    };

    for (const ancestor of chain) {
        accumulateAncestor(info, ancestor);
    }

    resolveBehaviorFlags(info);
    info.isLazy = chain.some((ancestor) => ELEMENTS[ancestor]?.isLazy === true);

    for (const ancestor of chain.toReversed()) {
        Object.assign(info.properties, properties[ancestor] ?? {});
    }

    resolveProperties(info);

    return info;
};

const typeInfoFor = (name: string): TypeInfo => getOrInsert(typeInfoCache, name, buildTypeInfo);

const removeResolvedProperty = (info: TypeInfo, accessor: string): void => {
    info.constructOnly.delete(accessor);
    info.construct.delete(accessor);
    Reflect.deleteProperty(info.defaults, accessor);
};

const runtimePropertyEntry = (
    info: TypeInfo,
    accessor: string,
    current: PropertyEntry | undefined,
): PropertyEntry | undefined => {
    const gtype = typeFromName(info.typeName);
    const runtime = getObjectPropertyInfo(gtype, accessor);

    if (runtime === undefined) {
        return undefined;
    }

    if (current !== undefined && current.length > DEFAULT_VALUE) {
        return [runtime.name, runtime.flags, runtime.defaultValue];
    }

    const wrapper = getWrapperClass(gtype);
    const isDeclared = getDeclaredPropertyName(wrapper.prototype, accessor) !== undefined;

    return isDeclared
        ? [runtime.name, runtime.flags, runtime.defaultValue]
        : [runtime.name, runtime.flags];
};

const ensureProperty = (info: TypeInfo, accessor: string): void => {
    const current = info.properties[accessor];
    const hasCurrentDefault = current !== undefined && current.length > DEFAULT_VALUE;

    if (info.resolvedProperties.has(accessor) || (!isLegacyMetadata && current !== undefined && !hasCurrentDefault)) {
        return;
    }

    const entry = runtimePropertyEntry(info, accessor, current);

    if (entry === undefined) {
        return;
    }

    info.resolvedProperties.add(accessor);
    removeResolvedProperty(info, accessor);
    info.properties[accessor] = entry;
    resolveProperty(info, accessor, entry);
};

const typeInfoForProps = (name: string, ...props: Props[]): TypeInfo => {
    const info = typeInfoFor(name);

    for (const values of props) {
        for (const accessor in values) {
            ensureProperty(info, accessor);
        }
    }

    return info;
};

const getTypeInfo = (object: GObject.Object): TypeInfo | undefined => {
    const name = typeName(getClassType(object.constructor as AnyClass));

    return name === null ? undefined : typeInfoFor(name);
};

const hasProperty = (info: TypeInfo, accessor: string): boolean => {
    ensureProperty(info, accessor);

    return Object.hasOwn(info.properties, accessor);
};

const propertyNameFor = (info: TypeInfo, accessor: string): string | undefined => {
    ensureProperty(info, accessor);

    return info.properties[accessor]?.[NAME];
};

const getPropertyName = (object: GObject.Object, accessor: string): string | undefined => {
    const info = getTypeInfo(object);

    return (info === undefined ? undefined : propertyNameFor(info, accessor)) ??
        getDeclaredPropertyName(object, accessor);
};

export { getPropertyName, hasProperty, typeInfoFor, typeInfoForProps, type TypeInfo };
