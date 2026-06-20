/// <reference types="@gtkx/config/env" />

import { CONSTRUCT_ONLY_PROPS, CONSTRUCT_PROPS, DEFAULT_PROPS, SIGNALS } from "virtual:gtkx-config";
import { type GType, type GTyped, typeName, typeParent } from "@gtkx/ffi";
import { NOTIFY_SIGNAL, propToNotifySignal } from "./notify-name.js";

const NOTIFY_PREFIX = "onNotify";

/**
 * Maps an `onNotify<Prop>` handler prop to the GObject `notify::<prop>` signal
 * it observes, or `null` when the prop is not an `onNotify` handler. The bare
 * `onNotify` prop maps to the undetailed `notify` signal.
 *
 * @param propName - The JSX prop name (e.g. `onNotifyActive`).
 */
export const resolveNotifySignal = (propName: string): string | null => {
    if (propName === NOTIFY_PREFIX) return NOTIFY_SIGNAL;
    if (!propName.startsWith(NOTIFY_PREFIX) || propName.length === NOTIFY_PREFIX.length) return null;
    const tail = propName.slice(NOTIFY_PREFIX.length);
    if (tail[0] !== tail[0]?.toUpperCase()) return null;
    return propToNotifySignal(tail);
};

const typeNameChainCache = new Map<GType, readonly string[]>();
const typeNameSetCache = new Map<GType, ReadonlySet<string>>();
const signalCache = new Map<GType, Map<string, string | null>>();
const constructOnlyCache = new Map<GType, Map<string, boolean>>();
const defaultPropCache = new Map<GType, Map<string, DefaultPropLookup>>();
const constructablePropsCache = new Map<GType, ReadonlySet<string>>();

/**
 * Returns a GLib type's ancestry as type names, most-derived first.
 *
 * Walks the type-parent chain from `gtype` up to the root, collecting each
 * {@link typeName}. The result is cached per GType.
 *
 * @param gtype - the GLib type whose ancestry to collect
 */
export const collectTypeNameChain = (gtype: GType): readonly string[] => {
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

/**
 * Folds the rows a per-type-name `table` holds for `gtype`'s ancestry into one
 * accumulator, visiting each matching row most-derived first. The table is keyed
 * by GLib type name; a type with no row contributes nothing. The chain walk is
 * the cached {@link collectTypeNameChain}, so the fold runs in ancestry length.
 *
 * @param gtype - the GLib type whose ancestry to fold over
 * @param table - per-type-name rows to merge
 * @param fold - combines the running accumulator with a matching row
 * @param seed - the accumulator's initial value
 */
export const foldInheritedTable = <R, T>(
    gtype: GType,
    table: Readonly<Record<string, R>>,
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

/**
 * The first row a per-type-name `table` holds for `gtype`'s ancestry that
 * `accept` admits, scanning most-derived first, or `undefined` when none does.
 * Shares the cached {@link collectTypeNameChain} walk.
 *
 * @param gtype - the GLib type whose ancestry to scan
 * @param table - per-type-name rows to search
 * @param accept - whether a candidate row is the one to return
 */
export const findInheritedRow = <R>(
    gtype: GType,
    table: Readonly<Record<string, R>>,
    accept: (row: R) => boolean,
): R | undefined => {
    for (const name of collectTypeNameChain(gtype)) {
        const row = table[name];
        if (row !== undefined && accept(row)) return row;
    }
    return undefined;
};

/**
 * Whether `name` appears in `gtype`'s ancestry. Backed by a per-GType set of
 * the names {@link collectTypeNameChain} returns, so repeated membership tests
 * cost one hash lookup.
 *
 * @param gtype - the GLib type whose ancestry to test
 * @param name - the GLib type name to look for
 */
export const typeChainIncludes = (gtype: GType, name: string): boolean => {
    let names = typeNameSetCache.get(gtype);
    if (!names) {
        names = new Set(collectTypeNameChain(gtype));
        typeNameSetCache.set(gtype, names);
    }
    return names.has(name);
};

const memoize = <T>(
    cache: Map<GType, Map<string, T>>,
    instance: GTyped,
    key: string,
    compute: (typeNames: readonly string[]) => T,
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

/**
 * The camelCase names of every construct-time GObject property a GType accepts —
 * the writable, construct, and construct-only properties its generated
 * constructor marshals — merged across its full ancestry. Used to narrow a JSX
 * prop bag to what `g_object_new_with_properties` can set, so children, signal
 * handlers, and framework-only props never reach construction. Cached per GType.
 *
 * @param gtype - the GLib type whose constructable property names to resolve
 */
export const collectConstructableProps = (gtype: GType): ReadonlySet<string> => {
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

/**
 * The outcome of a default-prop lookup: whether the property has a known
 * default and, if so, the value to reset it to. A discriminant is needed
 * because a valid default may itself be `null`, `false`, `0`, or `""`.
 */
export type DefaultPropLookup = { readonly has: boolean; readonly value: unknown };

const NO_DEFAULT_PROP: DefaultPropLookup = { has: false, value: undefined };

/**
 * Resolves the value a removed prop should be reset to: the property's GIR
 * default, looked up by walking the instance's GType ancestry against the
 * generated `DEFAULT_PROPS` table. Returns {@link NO_DEFAULT_PROP} when no
 * default is known, in which case the prop is left untouched.
 *
 * @param instance - the backing GObject whose property is being reset
 * @param key - the camelCase property name
 */
export const resolveDefaultProp = (instance: GTyped, key: string): DefaultPropLookup =>
    memoize(defaultPropCache, instance, key, (typeNames) => {
        for (const name of typeNames) {
            const table = DEFAULT_PROPS[name];
            if (table && key in table) return { has: true, value: table[key] };
        }
        return NO_DEFAULT_PROP;
    });
