import type { GirFunction } from "../../gir/function.js";
import type { ModuleContext } from "../../writer/context.js";

type RuntimeOverride = {
    generics?: string;
    signature: string;
    returnType: string;
    body: string;
    renames?: [string, string][];
    runtimeTypes?: string[];
    runtimeInternalTypes?: string[];
    paramDocs?: [string, string][];
};

const BINDING_TRANSFORM_TYPES = {
    runtimeTypes: ["NativeInstance"],
    runtimeInternalTypes: ["BindingTransform", "ReadablePropertyValue", "WritablePropertyValue"],
};

const bindingTransformDocs = (from: string, to: string): string =>
    `transforms each value read from ${from} into the value written to ${to}: a function that receives ` +
    "the binding and the value and returns `[success, value]`, as in GJS, or a `GObject.Closure`, which " +
    "receives the binding and both `GObject.Value`s and fills in the second; `null` uses the default conversion";

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
    [
        "g_object_bind_property_with_closures",
        {
            generics:
                "<TSource extends NativeInstance<Object>, TTarget extends NativeInstance<Object>, " +
                "TSourceProperty extends string, TTargetProperty extends string>",
            signature:
                "this: TSource, sourceProperty: TSourceProperty, target: TTarget, targetProperty: TTargetProperty, " +
                "flags: BindingFlags, transformTo?: BindingTransform<Binding, " +
                "ReadablePropertyValue<TSource, TSourceProperty>, WritablePropertyValue<TTarget, TTargetProperty>> " +
                "| Closure | null, transformFrom?: BindingTransform<Binding, " +
                "ReadablePropertyValue<TTarget, TTargetProperty>, WritablePropertyValue<TSource, TSourceProperty>> " +
                "| Closure | null",
            returnType: "Binding",
            body: 'throw new Error("g_object_bind_property_with_closures: runtime override not installed");',
            ...BINDING_TRANSFORM_TYPES,
            paramDocs: [
                ["transformTo", bindingTransformDocs("`sourceProperty`", "`targetProperty`")],
                [
                    "transformFrom",
                    `${bindingTransformDocs("`targetProperty`", "`sourceProperty`")}; only a bidirectional binding uses it`,
                ],
            ],
        },
    ],
    [
        "g_binding_group_bind_with_closures",
        {
            generics:
                "<TTarget extends NativeInstance<Object>, TTargetProperty extends string, TSourceValue = unknown>",
            signature:
                "sourceProperty: string, target: TTarget, targetProperty: TTargetProperty, flags: BindingFlags, " +
                "transformTo?: BindingTransform<Binding, TSourceValue, " +
                "WritablePropertyValue<TTarget, TTargetProperty>> | Closure | null, " +
                "transformFrom?: BindingTransform<Binding, ReadablePropertyValue<TTarget, TTargetProperty>, " +
                "TSourceValue> | Closure | null",
            returnType: "void",
            body: 'throw new Error("g_binding_group_bind_with_closures: runtime override not installed");',
            ...BINDING_TRANSFORM_TYPES,
            paramDocs: [
                ["transformTo", bindingTransformDocs("`sourceProperty`", "`targetProperty`")],
                [
                    "transformFrom",
                    `${bindingTransformDocs("`targetProperty`", "`sourceProperty`")}; only a bidirectional binding uses it`,
                ],
            ],
        },
    ],
]);

const runtimeOverrideFor = (callable: GirFunction): RuntimeOverride | undefined =>
    callable.instance === undefined || callable.cIdentifier === undefined
        ? undefined
        : RUNTIME_OVERRIDES.get(callable.cIdentifier);

const runtimeOverrideRenames = (callable: GirFunction): Map<string, string> | undefined => {
    const renames = runtimeOverrideFor(callable)?.renames;

    return renames === undefined ? undefined : new Map(renames);
};

const runtimeOverrideParamDocs = (callable: GirFunction): Map<string, string> | undefined => {
    const docs = runtimeOverrideFor(callable)?.paramDocs;

    return docs === undefined ? undefined : new Map(docs);
};

const importRuntimeOverride = (context: ModuleContext, callable: GirFunction): RuntimeOverride | undefined => {
    const override = runtimeOverrideFor(callable);

    for (const name of override?.runtimeTypes ?? []) {
        context.addRuntimeTypeImport(name);
    }

    for (const name of override?.runtimeInternalTypes ?? []) {
        context.addRuntimeInternalTypeImport(name);
    }

    return override;
};

const renderRuntimeOverride = (
    context: ModuleContext,
    callable: GirFunction,
    memberName: string,
): string | undefined => {
    const override = importRuntimeOverride(context, callable);

    if (override === undefined) {
        return undefined;
    }

    const generics = override.generics ?? "";

    return `${memberName}${generics}(${override.signature}): ${override.returnType} {\n    ${override.body}\n}`;
};

export {
    importRuntimeOverride,
    renderRuntimeOverride,
    runtimeOverrideFor,
    runtimeOverrideParamDocs,
    runtimeOverrideRenames,
    type RuntimeOverride,
};
