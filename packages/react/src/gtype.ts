import type { GType } from "@gtkx/gi/gobject";
import { typeName, typeParent } from "@gtkx/gi/gobject";
import { CONSTRUCT_ONLY_PROPS, SIGNALS } from "@gtkx/react-jsx/internal";
import type { BackingInstance } from "./types.js";

const typeNameChainCache = new Map<GType, readonly string[]>();
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
    instance: BackingInstance,
    key: string,
    compute: (typeNames: readonly string[]) => T,
): T => {
    const gtype = instance.__gtype__;
    let perGType = cache.get(gtype);
    if (!perGType) {
        perGType = new Map();
        cache.set(gtype, perGType);
    }
    const cached = perGType.get(key);
    if (cached !== undefined) return cached;
    const result = compute(collectTypeNameChain(gtype));
    perGType.set(key, result);
    return result;
};

export const isConstructOnlyProp = (instance: BackingInstance, key: string): boolean =>
    memoize(constructOnlyCache, instance, key, (typeNames) => {
        for (const name of typeNames) {
            if (CONSTRUCT_ONLY_PROPS[name]?.has(key)) return true;
        }
        return false;
    });

export const resolveSignal = (instance: BackingInstance, propName: string): string | null => {
    if (propName === "onNotify") return "notify";
    return memoize(signalCache, instance, propName, (typeNames) => {
        for (const name of typeNames) {
            const result = SIGNALS[name]?.[propName];
            if (result) return result;
        }
        return null;
    });
};
