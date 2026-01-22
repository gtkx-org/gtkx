import { PROPS, SIGNALS } from "../../generated/internal.js";
import type { Container, ContainerClass, Props } from "../../types.js";

// biome-ignore lint/suspicious/noExplicitAny: Required for generic class matching
type AnyClass = new (...args: any[]) => any;

export const matchesAnyClass = (
    classes: readonly AnyClass[],
    containerOrClass?: Container | ContainerClass | null,
): boolean => {
    if (!containerOrClass) {
        return false;
    }

    return classes.some(
        (cls) =>
            containerOrClass instanceof cls ||
            containerOrClass === cls ||
            Object.prototype.isPrototypeOf.call(cls, containerOrClass),
    );
};

export const matchesInterface = (
    methods: readonly string[],
    containerOrClass?: Container | ContainerClass | null,
): boolean => {
    if (!containerOrClass) {
        return false;
    }

    const proto = typeof containerOrClass === "function" ? containerOrClass.prototype : containerOrClass;
    return methods.every((method) => method in proto);
};

export const filterProps = (props: Props, excludeKeys: readonly string[]): Props => {
    const result: Props = {};

    for (const key of Object.keys(props)) {
        if (!excludeKeys.includes(key)) {
            result[key] = props[key];
        }
    }

    return result;
};

type GObjectClass = { glibTypeName?: string };

const walkPrototypeChain = <T>(instance: Container, lookup: (typeName: string) => T | null): T | null => {
    // biome-ignore lint/complexity/noBannedTypes: Walking prototype chain requires Function type
    let current: Function | null = instance.constructor;

    while (current) {
        const typeName = (current as GObjectClass).glibTypeName;
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

export const resolveSignal = (instance: Container, signalName: string): boolean => {
    if (signalName === "notify") return true;
    return walkPrototypeChain(instance, (typeName) => (SIGNALS[typeName]?.has(signalName) ? true : null)) ?? false;
};

export const propNameToSignalName = (propName: string): string => {
    if (!propName.startsWith("on")) return propName;
    return propName
        .slice(2)
        .replace(/([A-Z])/g, "-$1")
        .toLowerCase()
        .replace(/^-/, "");
};

export const hasChanged = <T>(oldProps: T | null, newProps: T, key: keyof T): boolean =>
    !oldProps || oldProps[key] !== newProps[key];

export const shallowArrayEqual = <T extends Record<string, unknown>>(a: T[], b: T[]): boolean => {
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; i++) {
        const itemA = a[i];
        const itemB = b[i];
        if (!itemA || !itemB) return false;

        const keysA = Object.keys(itemA);
        const keysB = Object.keys(itemB);
        if (keysA.length !== keysB.length) return false;

        for (const key of keysA) {
            if (itemA[key] !== itemB[key]) return false;
        }
    }

    return true;
};

export const primitiveArrayEqual = <T extends string | number | boolean>(
    a: T[] | null | undefined,
    b: T[] | null | undefined,
): boolean => {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }

    return true;
};
