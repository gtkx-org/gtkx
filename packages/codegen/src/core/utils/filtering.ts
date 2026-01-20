import { toCamelCase } from "./naming.js";

type ParameterLike = { readonly name: string };

export const isVararg = (param: ParameterLike): boolean => param.name === "..." || param.name === "";

export const filterVarargs = <T extends ParameterLike>(params: readonly T[]): T[] => params.filter((p) => !isVararg(p));

export const hasVarargs = (params: readonly ParameterLike[]): boolean => params.some(isVararg);

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
    readonly returnType?: { readonly name: string };
    readonly shadowedBy?: string;
};

const hasUnsupportedReturnType = (method: MethodLike): boolean => method.returnType?.name === "gpointer";

export function filterSupportedMethods<T extends MethodLike>(
    methods: readonly T[],
    hasUnsupportedCallbacks: (params: T["parameters"]) => boolean,
): T[] {
    const seen = new Set<string>();
    return methods.filter((method) => {
        if (method.shadowedBy) return false;
        if (isMethodDuplicate(method.name, method.cIdentifier, seen)) return false;
        if (hasUnsupportedCallbacks(method.parameters)) return false;
        if (hasUnsupportedReturnType(method)) return false;
        return true;
    });
}

type FunctionLike = {
    readonly parameters: readonly { readonly name: string }[];
    readonly returnType?: { readonly name: string };
    readonly shadowedBy?: string;
};

const hasUnsupportedFunctionReturnType = (fn: FunctionLike): boolean => fn.returnType?.name === "gpointer";

export function filterSupportedFunctions<T extends FunctionLike>(
    functions: readonly T[],
    hasUnsupportedCallbacks: (params: T["parameters"]) => boolean,
): T[] {
    return functions.filter((fn) => {
        if (fn.shadowedBy) return false;
        if (hasUnsupportedCallbacks(fn.parameters)) return false;
        if (hasUnsupportedFunctionReturnType(fn)) return false;
        return true;
    });
}
