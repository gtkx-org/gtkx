/// <reference types="@gtkx/config/env" />

import {
    CONSTRUCT_ONLY_PROPS,
    CONSTRUCT_PROPS,
    DEFAULT_BLOCKABLE_TYPES,
    DEFAULT_PROPS,
    SIGNALS,
} from "virtual:gtkx-config";
import type { TypedClass } from "@gtkx/ffi";
import { typeInterfaces, typeName, typeParent } from "@gtkx/gi/gobject";
import { NOTIFY_SIGNAL, propToNotifySignal } from "./notify-name.js";

const NOTIFY_PREFIX = "onNotify";

const resolveNotifySignal = (propName: string): string | null => {
    if (propName === NOTIFY_PREFIX) return NOTIFY_SIGNAL;
    if (!propName.startsWith(NOTIFY_PREFIX) || propName.length === NOTIFY_PREFIX.length) return null;
    const tail = propName.slice(NOTIFY_PREFIX.length);
    if (tail[0] !== tail[0]?.toUpperCase()) return null;
    return propToNotifySignal(tail);
};

const typeNameChainCache = new Map<bigint, string[]>();
const interfaceNamesCache = new Map<bigint, string[]>();
const typeNameSetCache = new Map<bigint, Set<string>>();
const signalCache = new Map<bigint, Map<string, string | null>>();
const constructOnlyCache = new Map<bigint, Map<string, boolean>>();
const defaultPropCache = new Map<bigint, Map<string, DefaultPropLookup>>();
const constructablePropsCache = new Map<bigint, Set<string>>();

export const collectTypeNameChain = (gtype: bigint): string[] => {
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

const collectInterfaceNames = (gtype: bigint): string[] => {
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

const typeNamesWithInterfacesCache = new Map<bigint, string[]>();

export const collectTypeNamesWithInterfaces = (gtype: bigint): string[] => {
    const cached = typeNamesWithInterfacesCache.get(gtype);
    if (cached) return cached;
    const names = [...collectTypeNameChain(gtype), ...collectInterfaceNames(gtype)];
    typeNamesWithInterfacesCache.set(gtype, names);
    return names;
};

export const foldInheritedTable = <R, T>(
    gtype: bigint,
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
    gtype: bigint,
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

export const typeChainIncludes = (gtype: bigint, name: string): boolean => {
    let names = typeNameSetCache.get(gtype);
    if (!names) {
        names = new Set(collectTypeNameChain(gtype));
        typeNameSetCache.set(gtype, names);
    }
    return names.has(name);
};

export const isDefaultBlockableType = (gtype: bigint): boolean =>
    DEFAULT_BLOCKABLE_TYPES.some((name) => typeChainIncludes(gtype, name));

const memoize = <T>(
    cache: Map<bigint, Map<string, T>>,
    instance: TypedClass,
    key: string,
    compute: (typeNames: string[]) => T,
): T => {
    const gtype = instance.__type__;
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

export const collectConstructableProps = (gtype: bigint): Set<string> => {
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

export const isConstructOnlyProp = (instance: TypedClass, key: string): boolean =>
    memoize(constructOnlyCache, instance, key, (typeNames) => {
        for (const name of typeNames) {
            if (CONSTRUCT_ONLY_PROPS[name]?.has(key)) return true;
        }
        return false;
    });

export const resolveSignal = (instance: TypedClass, propName: string): string | null => {
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

export const resolveDefaultProp = (instance: TypedClass, key: string): DefaultPropLookup =>
    memoize(defaultPropCache, instance, key, (typeNames) => {
        for (const name of typeNames) {
            const table = DEFAULT_PROPS[name];
            if (table && key in table) return { has: true, value: table[key] };
        }
        return NO_DEFAULT_PROP;
    });
