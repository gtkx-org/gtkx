import type { GType } from "@gtkx/ffi/gobject";
import { typeName, typeParent } from "@gtkx/ffi/gobject";
import { CONSTRUCT_ONLY, PROPS, SIGNALS } from "./generated/internal.js";
import type { Container } from "./types.js";

const typeNameChainCache = new Map<GType, readonly string[]>();
const propMetaCache = new Map<GType, Map<string, string | null>>();
const signalCache = new Map<GType, Map<string, string | null>>();
const constructOnlyCache = new Map<GType, Map<string, boolean>>();

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
    while (current !== 0) {
        const name = typeName(current);
        if (!name) break;
        chain.push(name);
        current = typeParent(current);
    }

    typeNameChainCache.set(gtype, chain);
    return chain;
};

const memoize = <T>(
    cache: Map<GType, Map<string, T>>,
    instance: Container,
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

export const resolvePropMeta = (instance: Container, key: string): string | null =>
    memoize(propMetaCache, instance, key, (typeNames) => {
        for (const name of typeNames) {
            const result = PROPS[name]?.[key];
            if (result) return result;
        }
        return null;
    });

export const isConstructOnlyProp = (instance: Container, key: string): boolean =>
    memoize(constructOnlyCache, instance, key, (typeNames) => {
        for (const name of typeNames) {
            if (CONSTRUCT_ONLY[name]?.has(key)) return true;
        }
        return false;
    });

export const resolveSignal = (instance: Container, propName: string): string | null => {
    if (propName === "onNotify") return "notify";
    return memoize(signalCache, instance, propName, (typeNames) => {
        for (const name of typeNames) {
            const result = SIGNALS[name]?.[propName];
            if (result) return result;
        }
        return null;
    });
};
