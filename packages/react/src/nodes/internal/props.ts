import type { Props } from "../../types.js";

export const filterProps = <T extends Props>(props: T, excludeKeys: readonly string[]): T => {
    const result: Props = {};

    for (const key of Object.keys(props)) {
        if (!excludeKeys.includes(key)) {
            result[key] = props[key];
        }
    }

    return result as T;
};

export const hasChanged = <T>(oldProps: T | null, newProps: T, key: keyof T): boolean =>
    !oldProps || oldProps[key] !== newProps[key];

export const shallowArrayEqual = <T extends Record<string, unknown>>(a: readonly T[], b: readonly T[]): boolean => {
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
    a: readonly T[] | null | undefined,
    b: readonly T[] | null | undefined,
): boolean => {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }

    return true;
};
