import { toCamelCase } from "./naming.js";

const toMethodKey = (name: string, cIdentifier: string): string => `${toCamelCase(name)}:${cIdentifier}`;

export const isMethodDuplicate = (name: string, cIdentifier: string, seen: Set<string>): boolean => {
    const key = toMethodKey(name, cIdentifier);
    if (seen.has(key)) return true;
    seen.add(key);
    return false;
};

type MethodLike = {
    readonly name: string;
    readonly cIdentifier: string;
    readonly parameters: readonly { readonly name: string }[];
};

export function filterSupportedMethods<T extends MethodLike>(
    methods: readonly T[],
    hasUnsupportedCallbacks: (params: T["parameters"]) => boolean,
): T[] {
    const seen = new Set<string>();
    return methods.filter((method) => {
        if (isMethodDuplicate(method.name, method.cIdentifier, seen)) return false;
        if (hasUnsupportedCallbacks(method.parameters)) return false;
        return true;
    });
}

type FunctionLike = {
    readonly parameters: readonly { readonly name: string }[];
};

export function filterSupportedFunctions<T extends FunctionLike>(
    functions: readonly T[],
    hasUnsupportedCallbacks: (params: T["parameters"]) => boolean,
): T[] {
    return functions.filter((fn) => !hasUnsupportedCallbacks(fn.parameters));
}
