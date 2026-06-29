import { type GirParameter, isInoutParameter } from "../../gir/parameter.js";
import type { GirType } from "../../gir/type.js";
import type { TypeId } from "../../gir/type-id.js";
import type { ModuleContext } from "../../writer/context.js";

export const passesHandleInPlace = (context: ModuleContext, parameter: GirParameter): boolean => {
    if (parameter.direction !== "out" && parameter.direction !== "inout") return false;
    return (
        (parameter.callerAllocates || parameter.direction === "inout") &&
        parameter.type !== undefined &&
        isHandlePassing(context, parameter.type)
    );
};

const underlyingType = (context: ModuleContext, ref: TypeId): GirType | undefined => {
    const type = context.library.typeOf(ref);
    if (type?.kind !== "alias") return type;
    return type.value.target === undefined ? undefined : underlyingType(context, type.value.target);
};

const underlyingParamKind = (context: ModuleContext, parameter: GirParameter): GirType["kind"] | undefined =>
    parameter.type === undefined ? undefined : underlyingType(context, parameter.type)?.kind;

export const isCollectibleCallerOut = (context: ModuleContext, parameter: GirParameter): boolean => {
    const kind = underlyingParamKind(context, parameter);
    return kind === "record" || kind === "class";
};

export const isRecordCallerOut = (context: ModuleContext, parameter: GirParameter): boolean =>
    underlyingParamKind(context, parameter) === "record";

export const isRecordInout = (context: ModuleContext, parameter: GirParameter): boolean =>
    isInoutParameter(parameter) && underlyingParamKind(context, parameter) === "record";

export const isHandlePassing = (context: ModuleContext, ref: TypeId): boolean => {
    const type = context.library.typeOf(ref);
    if (type === undefined) return true;
    switch (type.kind) {
        case "class":
        case "interface":
        case "record":
            return true;
        case "alias":
            return type.value.target !== undefined && isHandlePassing(context, type.value.target);
        default:
            return false;
    }
};
