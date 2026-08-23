import type * as GObject from "@gtkx/gi/gobject";
import {
    type AnyClass,
    getClassType,
    getDeclaredPropertyName,
    TYPE_INVALID,
    typeFromName,
    typeInterfaces,
    typeName,
    typeParent,
} from "@gtkx/runtime";
import { getOrInsert } from "@gtkx/utils";
import { properties, type PropertyEntry, signals, userEventSignals } from "virtual:gtkx-config";
import { deferredProps, type ElementBehavior, ELEMENTS } from "./registry.js";

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
};

const WRITABLE = 2;
const CONSTRUCT = 4;
const CONSTRUCT_ONLY = 8;
const NAME = 0;
const FLAGS = 1;
const DEFAULT_VALUE = 2;
const ancestryCache: Map<string, string[]> = new Map();
const typeInfoCache: Map<string, TypeInfo> = new Map();

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

const getTypeInfo = (object: GObject.Object): TypeInfo | undefined => {
    const name = typeName(getClassType(object.constructor as AnyClass));

    return name === null ? undefined : typeInfoFor(name);
};

const hasProperty = (info: TypeInfo, accessor: string): boolean => Object.hasOwn(info.properties, accessor);

const propertyNameFor = (info: TypeInfo, accessor: string): string | undefined =>
    info.properties[accessor]?.[NAME];

const getPropertyName = (object: GObject.Object, accessor: string): string | undefined => {
    const info = getTypeInfo(object);

    return (info === undefined ? undefined : propertyNameFor(info, accessor)) ??
        getDeclaredPropertyName(object, accessor);
};

export { getPropertyName, hasProperty, typeInfoFor, type TypeInfo };
