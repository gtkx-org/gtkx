import type { ModuleContext } from "../dsl/context.js";
import { type GirParameter, isInoutParameter } from "../gir/parameter.js";
import type { GirType } from "../gir/type.js";
import type { TypeId } from "../gir/type-id.js";

export const passesHandleInPlace = (context: ModuleContext, parameter: GirParameter): boolean => {
    if (parameter.direction !== "out" && parameter.direction !== "inout") return false;
    return (
        (parameter.callerAllocates || parameter.direction === "inout") &&
        parameter.type !== undefined &&
        isHandlePassing(context, parameter.type)
    );
};

const resolveNamedParam = (context: ModuleContext, parameter: GirParameter): GirType | undefined =>
    parameter.type === undefined ? undefined : context.repository.typeOf(parameter.type);

export const isCollectibleCallerOut = (context: ModuleContext, parameter: GirParameter): boolean => {
    const kind = resolveNamedParam(context, parameter)?.kind;
    return kind === "boxed" || kind === "class";
};

export const isBoxedCallerOut = (context: ModuleContext, parameter: GirParameter): boolean =>
    resolveNamedParam(context, parameter)?.kind === "boxed";

export const isBoxedInout = (context: ModuleContext, parameter: GirParameter): boolean =>
    isInoutParameter(parameter) && resolveNamedParam(context, parameter)?.kind === "boxed";

export const isHandlePassing = (context: ModuleContext, ref: TypeId): boolean => {
    const type = context.repository.typeOf(ref);
    if (type === undefined) return true;
    switch (type.kind) {
        case "class":
        case "interface":
        case "boxed":
            return true;
        case "alias":
            return type.target !== undefined && isHandlePassing(context, type.target);
        default:
            return false;
    }
};
