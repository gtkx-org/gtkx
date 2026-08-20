import type { GirFunction } from "../../gir/function.js";

type RuntimeOverride = {
    generics?: string;
    signature: string;
    returnType: string;
    body: string;
    renames?: [string, string][];
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
            signature: "boxed: object | string | number | bigint | boolean | null",
            returnType: "void",
            body: 'throw new Error("g_value_set_boxed: runtime override not installed");',
            renames: [["v_boxed", "boxed"]],
        },
    ],
]);

const runtimeOverrideFor = (callable: GirFunction): RuntimeOverride | undefined =>
    callable.cIdentifier === undefined ? undefined : RUNTIME_OVERRIDES.get(callable.cIdentifier);

const runtimeOverrideRenames = (callable: GirFunction): Map<string, string> | undefined => {
    const renames = runtimeOverrideFor(callable)?.renames;

    return renames === undefined ? undefined : new Map(renames);
};

const renderRuntimeOverride = (callable: GirFunction, memberName: string): string | undefined => {
    const override = runtimeOverrideFor(callable);

    if (override === undefined) {
        return undefined;
    }

    const generics = override.generics ?? "";

    return `${memberName}${generics}(${override.signature}): ${override.returnType} {\n    ${override.body}\n}`;
};

export { renderRuntimeOverride, runtimeOverrideRenames };
