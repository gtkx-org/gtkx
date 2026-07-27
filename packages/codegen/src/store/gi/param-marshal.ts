import type { TypeId } from "../../gir/type-id.js";
import type { GirType } from "../../gir/type.js";
import type { ModuleContext } from "../../writer/context.js";
import { type GirParameter, isInoutParameter } from "../../gir/parameter.js";

const isHandlePassedInPlace = (context: ModuleContext, parameter: GirParameter): boolean => {
    if (parameter.direction !== "out" && parameter.direction !== "inout") {
        return false;
    }

    return (
        (parameter.callerAllocates || parameter.direction === "inout") &&
        parameter.type !== undefined &&
        isHandlePassing(context, parameter.type)
    );
};

const underlyingType = (context: ModuleContext, ref: TypeId): GirType | undefined => {
    const type = context.library.typeFor(ref);

    if (type?.kind !== "alias") {
        return type;
    }

    return type.value.target === undefined ? undefined : underlyingType(context, type.value.target);
};

const underlyingParamKind = (context: ModuleContext, parameter: GirParameter): GirType["kind"] | undefined =>
    parameter.type === undefined ? undefined : underlyingType(context, parameter.type)?.kind;

const isCollectibleCallerOut = (context: ModuleContext, parameter: GirParameter): boolean => {
    const kind = underlyingParamKind(context, parameter);

    return kind === "record" || kind === "class";
};

const isRecordCallerOut = (context: ModuleContext, parameter: GirParameter): boolean =>
    underlyingParamKind(context, parameter) === "record";

const isRecordInout = (context: ModuleContext, parameter: GirParameter): boolean =>
    isInoutParameter(parameter) && underlyingParamKind(context, parameter) === "record";

const isHandlePassing = (context: ModuleContext, ref: TypeId): boolean => {
    const type = context.library.typeFor(ref);

    if (type === undefined) {
        return true;
    }

    switch (type.kind) {
        case "class":
        case "interface":
        case "record": {
            return true;
        }
        case "alias": {
            return type.value.target !== undefined && isHandlePassing(context, type.value.target);
        }
        case "callback":
        case "carray":
        case "enum":
        case "hashtable":
        case "list":
        case "primitive":
        case "varargs": {
            return false;
        }
    }
};

export { isHandlePassedInPlace, isCollectibleCallerOut, isRecordCallerOut, isRecordInout, isHandlePassing };
