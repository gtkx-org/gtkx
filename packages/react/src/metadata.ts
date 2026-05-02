import type { NativeClass } from "@gtkx/ffi";
import { CONSTRUCTION_META, PROPS, SIGNALS } from "./generated/internal.js";
import type { Container } from "./types.js";

// biome-ignore lint/complexity/noBannedTypes: prototype chain inspection requires Function type
type Ctor = Function;

const typeNameChainCache = new WeakMap<Ctor, readonly string[]>();
const propMetaCache = new WeakMap<Ctor, Map<string, string | null>>();
const signalCache = new WeakMap<Ctor, Map<string, string | null>>();
const constructOnlyCache = new WeakMap<Ctor, Map<string, boolean>>();

const collectTypeNameChain = (ctor: Ctor): readonly string[] => {
    const cached = typeNameChainCache.get(ctor);
    if (cached) return cached;

    const chain: string[] = [];
    let current: Ctor | null = ctor;
    while (current) {
        const typeName = (current as NativeClass).glibTypeName;
        if (typeName) chain.push(typeName);

        const prototype = Object.getPrototypeOf(current.prototype);
        current = prototype?.constructor ?? null;
        if (current === Object || current === Function) break;
    }

    typeNameChainCache.set(ctor, chain);
    return chain;
};

const memoize = <T>(
    cache: WeakMap<Ctor, Map<string, T>>,
    instance: Container,
    key: string,
    compute: (typeNames: readonly string[]) => T,
): T => {
    const ctor = instance.constructor;
    let perCtor = cache.get(ctor);
    if (!perCtor) {
        perCtor = new Map();
        cache.set(ctor, perCtor);
    }
    const cached = perCtor.get(key);
    if (cached !== undefined) return cached;
    const result = compute(collectTypeNameChain(ctor));
    perCtor.set(key, result);
    return result;
};

export const resolvePropMeta = (instance: Container, key: string): string | null =>
    memoize(propMetaCache, instance, key, (typeNames) => {
        for (const typeName of typeNames) {
            const result = PROPS[typeName]?.[key];
            if (result) return result;
        }
        return null;
    });

export const isConstructOnlyProp = (instance: Container, key: string): boolean =>
    memoize(constructOnlyCache, instance, key, (typeNames) => {
        for (const typeName of typeNames) {
            const meta = CONSTRUCTION_META[typeName];
            if (meta && key in meta) {
                return meta[key]?.constructOnly === true;
            }
        }
        return false;
    });

export const resolveSignal = (instance: Container, propName: string): string | null => {
    if (propName === "onNotify") return "notify";
    return memoize(signalCache, instance, propName, (typeNames) => {
        for (const typeName of typeNames) {
            const result = SIGNALS[typeName]?.[propName];
            if (result) return result;
        }
        return null;
    });
};
