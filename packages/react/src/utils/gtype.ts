/// <reference types="@gtkx/config/env" />

import {
    ATTACH_SHAPES,
    CONSTRUCT_ONLY_PROPS,
    CONSTRUCT_PROPS,
    DEFAULT_BLOCKABLE_TYPES,
    DEFAULT_PROPS,
    SIGNALS,
} from "virtual:gtkx-config";
import type { AttachShape } from "@gtkx/config";
import { type GType, type GTyped, typeInterfaces, typeName, typeParent } from "@gtkx/ffi";
import { NOTIFY_SIGNAL, propToNotifySignal } from "./notify-name.js";

const NOTIFY_PREFIX = "onNotify";

export const resolveNotifySignal = (propName: string): string | null => {
    if (propName === NOTIFY_PREFIX) return NOTIFY_SIGNAL;
    if (!propName.startsWith(NOTIFY_PREFIX) || propName.length === NOTIFY_PREFIX.length) return null;
    const tail = propName.slice(NOTIFY_PREFIX.length);
    if (tail[0] !== tail[0]?.toUpperCase()) return null;
    return propToNotifySignal(tail);
};

const typeNameChainCache = new Map<GType, string[]>();
const interfaceNamesCache = new Map<GType, string[]>();
const typeNameSetCache = new Map<GType, Set<string>>();
const signalCache = new Map<GType, Map<string, string | null>>();
const constructOnlyCache = new Map<GType, Map<string, boolean>>();
const defaultPropCache = new Map<GType, Map<string, DefaultPropLookup>>();
const constructablePropsCache = new Map<GType, Set<string>>();
const attachShapesCache = new Map<GType, Set<AttachShape>>();

export const collectTypeNameChain = (gtype: GType): string[] => {
    const cached = typeNameChainCache.get(gtype);
    if (cached) return cached;

    const chain: string[] = [];
    let current = gtype;
    while (current !== 0n) {
        const name = typeName(current);
        if (!name) break;
        chain.push(name);
        current = typeParent(current);
    }

    typeNameChainCache.set(gtype, chain);
    return chain;
};

export const collectInterfaceNames = (gtype: GType): string[] => {
    const cached = interfaceNamesCache.get(gtype);
    if (cached) return cached;

    const names: string[] = [];
    for (const iface of typeInterfaces(gtype)) {
        const name = typeName(iface);
        if (name) names.push(name);
    }

    interfaceNamesCache.set(gtype, names);
    return names;
};

export const foldInheritedTable = <R, T>(
    gtype: GType,
    table: Record<string, R>,
    fold: (accumulator: T, row: R) => T,
    seed: T,
): T => {
    let accumulator = seed;
    for (const name of collectTypeNameChain(gtype)) {
        const row = table[name];
        if (row !== undefined) accumulator = fold(accumulator, row);
    }
    return accumulator;
};

export const foldInheritedTableWithInterfaces = <R, T>(
    gtype: GType,
    table: Record<string, R>,
    fold: (accumulator: T, row: R) => T,
    seed: T,
): T => {
    let accumulator = foldInheritedTable(gtype, table, fold, seed);
    for (const name of collectInterfaceNames(gtype)) {
        const row = table[name];
        if (row !== undefined) accumulator = fold(accumulator, row);
    }
    return accumulator;
};

export const findInheritedRow = <R>(
    gtype: GType,
    table: Record<string, R>,
    accept: (row: R) => boolean,
): R | undefined => {
    for (const name of collectTypeNameChain(gtype)) {
        const row = table[name];
        if (row !== undefined && accept(row)) return row;
    }
    return undefined;
};

export const typeChainIncludes = (gtype: GType, name: string): boolean => {
    let names = typeNameSetCache.get(gtype);
    if (!names) {
        names = new Set(collectTypeNameChain(gtype));
        typeNameSetCache.set(gtype, names);
    }
    return names.has(name);
};

export const isDefaultBlockableType = (gtype: GType): boolean =>
    DEFAULT_BLOCKABLE_TYPES.some((name) => typeChainIncludes(gtype, name));

/**
 * Resolves the verified child-attachment shapes a type satisfies by unioning the
 * codegen-emitted {@link ATTACH_SHAPES} entries across the type-name chain and its
 * implemented interfaces. Each shape is present only when codegen confirmed the
 * underlying method exists with the expected signature.
 */
export const collectAttachShapes = (gtype: GType): Set<AttachShape> => {
    const cached = attachShapesCache.get(gtype);
    if (cached) return cached;
    const shapes = foldInheritedTableWithInterfaces<AttachShape[], Set<AttachShape>>(
        gtype,
        ATTACH_SHAPES,
        (collected, row) => {
            for (const shape of row) collected.add(shape);
            return collected;
        },
        new Set<AttachShape>(),
    );
    attachShapesCache.set(gtype, shapes);
    return shapes;
};

const memoize = <T>(
    cache: Map<GType, Map<string, T>>,
    instance: GTyped,
    key: string,
    compute: (typeNames: string[]) => T,
): T => {
    const gtype = instance.__gtype__;
    let perGtype = cache.get(gtype);
    if (!perGtype) {
        perGtype = new Map();
        cache.set(gtype, perGtype);
    }
    const cached = perGtype.get(key);
    if (cached !== undefined) return cached;
    const result = compute(collectTypeNameChain(gtype));
    perGtype.set(key, result);
    return result;
};

export const collectConstructableProps = (gtype: GType): Set<string> => {
    const cached = constructablePropsCache.get(gtype);
    if (cached) return cached;
    const names = foldInheritedTable(
        gtype,
        CONSTRUCT_PROPS,
        (collected: Set<string>, props) => {
            for (const prop of props) collected.add(prop);
            return collected;
        },
        new Set<string>(),
    );
    constructablePropsCache.set(gtype, names);
    return names;
};

export const isConstructOnlyProp = (instance: GTyped, key: string): boolean =>
    memoize(constructOnlyCache, instance, key, (typeNames) => {
        for (const name of typeNames) {
            if (CONSTRUCT_ONLY_PROPS[name]?.has(key)) return true;
        }
        return false;
    });

export const resolveSignal = (instance: GTyped, propName: string): string | null => {
    const notify = resolveNotifySignal(propName);
    if (notify) return notify;
    return memoize(signalCache, instance, propName, (typeNames) => {
        for (const name of typeNames) {
            const result = SIGNALS[name]?.[propName];
            if (result) return result;
        }
        return null;
    });
};

export type DefaultPropLookup = { has: boolean; value: unknown };

const NO_DEFAULT_PROP: DefaultPropLookup = { has: false, value: undefined };

export const resolveDefaultProp = (instance: GTyped, key: string): DefaultPropLookup =>
    memoize(defaultPropCache, instance, key, (typeNames) => {
        for (const name of typeNames) {
            const table = DEFAULT_PROPS[name];
            if (table && key in table) return { has: true, value: table[key] };
        }
        return NO_DEFAULT_PROP;
    });
