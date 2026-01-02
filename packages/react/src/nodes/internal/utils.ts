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

export const isContainerType = (cls: AnyClass, containerOrClass?: Container | ContainerClass | null): boolean =>
    matchesAnyClass([cls], containerOrClass);

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

export const filterProps = (props: Props, excludeKeys: string[]): Props => {
    const result: Props = {};

    for (const key of Object.keys(props)) {
        if (!excludeKeys.includes(key)) {
            result[key] = props[key];
        }
    }

    return result;
};

const walkPrototypeChain = <T>(container: Container, lookup: (typeName: string) => T | null): T | null => {
    // biome-ignore lint/complexity/noBannedTypes: Walking prototype chain requires Function type
    let current: Function | null = container.constructor;

    while (current) {
        const typeName = (current as ContainerClass).glibTypeName;
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

export const resolvePropMeta = (container: Container, key: string): [string | null, string] | null =>
    walkPrototypeChain(container, (typeName) => PROPS[typeName]?.[key] ?? null);

export const resolveSignal = (container: Container, signalName: string): boolean =>
    walkPrototypeChain(container, (typeName) => (SIGNALS[typeName]?.has(signalName) ? true : null)) ?? false;
