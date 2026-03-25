import type { NativeClass } from "@gtkx/ffi";
import { CONSTRUCTION_META, PROPS, SIGNALS } from "./generated/internal.js";
import type { Container } from "./types.js";

const walkPrototypeChain = <T>(instance: Container, lookup: (typeName: string) => T | null): T | null => {
    // biome-ignore lint/complexity/noBannedTypes: Walking prototype chain requires Function type
    let current: Function | null = instance.constructor;

    while (current) {
        const typeName = (current as NativeClass).glibTypeName;

        if (typeName) {
            const result = lookup(typeName);
            if (result !== null) {
                return result;
            }
        }

        const prototype = Object.getPrototypeOf(current.prototype);
        current = prototype?.constructor ?? null;

        if (current === Object || current === Function) {
            break;
        }
    }

    return null;
};

export const resolvePropMeta = (instance: Container, key: string): string | null =>
    walkPrototypeChain(instance, (typeName) => PROPS[typeName]?.[key] ?? null);

export const isConstructOnlyProp = (instance: Container, key: string): boolean =>
    walkPrototypeChain(instance, (typeName) => {
        const meta = CONSTRUCTION_META[typeName];
        if (!meta || !(key in meta)) return null;
        return meta[key]?.constructOnly === true;
    }) ?? false;

export const resolveSignal = (instance: Container, propName: string): string | null => {
    if (propName === "onNotify") return "notify";
    return walkPrototypeChain(instance, (typeName) => SIGNALS[typeName]?.[propName] ?? null);
};
