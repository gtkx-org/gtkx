import type { GirFunction } from "../../gir/function.js";

type RuntimeOverride = {
    generics?: string;
    signature: string;
    returnType: string;
    body: string;
};

const RUNTIME_OVERRIDES: Map<string, RuntimeOverride> = new Map([
    [
        "g_value_get_boxed",
        {
            generics: "<T = unknown>",
            signature: "",
            returnType: "T",
            body: 'throw new Error("g_value_get_boxed: runtime override not installed");',
        },
    ],
    [
        "g_value_set_boxed",
        {
            signature: "boxed: object | null",
            returnType: "void",
            body: 'throw new Error("g_value_set_boxed: runtime override not installed");',
        },
    ],
]);

const renderRuntimeOverride = (callable: GirFunction, memberName: string): string | undefined => {
    if (callable.cIdentifier === undefined) {
        return undefined;
    }

    const override = RUNTIME_OVERRIDES.get(callable.cIdentifier);

    if (override === undefined) {
        return undefined;
    }

    const generics = override.generics ?? "";

    return `${memberName}${generics}(${override.signature}): ${override.returnType} {\n    ${override.body}\n}`;
};

export { renderRuntimeOverride };
