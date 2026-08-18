import type { GirCallable, GirParameter, ParameterTransfer } from "../gir/parameter.js";
import type { CArrayType, TypeId } from "../gir/type-id.js";
import type { GirType } from "../gir/type.js";
import type { ModuleContext } from "../writer/context.js";
import { isCallerAllocatedOut, isInoutParameter } from "../gir/parameter.js";
import {
    isCollectibleCallerOut,
    isHandlePassedInPlace,
    isRecordInout,
    underlyingType,
} from "../store/gi/param-marshal.js";
import { recordInlineSize } from "../store/gi/record-layout.js";
import { isPlainStruct, isScalarRef, transferOwnership } from "./descriptor-render.js";

type UnmarshalableSubject = GirCallable & { instance?: GirParameter | undefined };

const POINTER_DEPTH = 1;

const isPointerType = (context: ModuleContext, type: GirType): boolean => {
    switch (type.kind) {
        case "primitive": {
            return type.category === "string";
        }
        case "record": {
            return recordInlineSize(context, type.value) === undefined;
        }
        case "class":
        case "interface":
        case "carray":
        case "list":
        case "hashtable": {
            return true;
        }
        case "alias":
        case "callback":
        case "enum":
        case "varargs": {
            return false;
        }
    }
};

const isPointerElement = (context: ModuleContext, element: TypeId): boolean => {
    if (isScalarRef(context.library, element)) {
        return false;
    }

    const type = underlyingType(context, element);

    return type !== undefined && isPointerType(context, type);
};

const carrayIndirection = (context: ModuleContext, type: CArrayType): number =>
    POINTER_DEPTH + (isPointerElement(context, type.element) ? POINTER_DEPTH : 0);

const typeIndirection = (context: ModuleContext, type: GirType): number | undefined => {
    switch (type.kind) {
        case "primitive": {
            return type.category === "string" ? POINTER_DEPTH : undefined;
        }
        case "callback":
        case "class":
        case "hashtable":
        case "interface":
        case "list":
        case "record": {
            return POINTER_DEPTH;
        }
        case "carray": {
            return carrayIndirection(context, type);
        }
        case "alias":
        case "enum":
        case "varargs": {
            return undefined;
        }
    }
};

const baseIndirection = (context: ModuleContext, ref: TypeId | undefined): number | undefined => {
    if (isScalarRef(context.library, ref)) {
        return 0;
    }

    const type = ref === undefined ? undefined : underlyingType(context, ref);

    return type === undefined ? undefined : typeIndirection(context, type);
};

const declaredIndirection = (parameter: GirParameter): number | undefined => {
    const cType = parameter.cType;

    if (cType === undefined) {
        return undefined;
    }

    return cType.split("*").length - 1;
};

const marshalledIndirection = (context: ModuleContext, parameter: GirParameter): number | undefined => {
    const base = baseIndirection(context, parameter.type);

    if (base === undefined) {
        return undefined;
    }

    if (isCallerAllocatedOut(parameter) || isHandlePassedInPlace(context, parameter)) {
        return base;
    }

    if (isInoutParameter(parameter) && !isScalarRef(context.library, parameter.type)) {
        return base;
    }

    return base + POINTER_DEPTH;
};

const hasCallerSuppliedLength = (context: ModuleContext, parameter: GirParameter): boolean => {
    const type = parameter.type === undefined ? undefined : underlyingType(context, parameter.type);

    return type?.kind === "carray" && type.lengthParameterIndex !== undefined;
};

const isUnmarshalableCallerOut = (context: ModuleContext, parameter: GirParameter): boolean => {
    if (hasCallerSuppliedLength(context, parameter)) {
        return true;
    }

    return !isCollectibleCallerOut(context, parameter) && !parameter.optional;
};

const hasIndirectionMismatch = (context: ModuleContext, parameter: GirParameter): boolean => {
    const declared = declaredIndirection(parameter);
    const marshalled = marshalledIndirection(context, parameter);

    if (declared === undefined || marshalled === undefined) {
        return false;
    }

    return declared !== marshalled;
};

const isTypeErasedCallback = (context: ModuleContext, parameter: GirParameter): boolean => {
    if (parameter.closureIndex === undefined) {
        return false;
    }

    const type = parameter.type === undefined ? undefined : underlyingType(context, parameter.type);

    return type?.kind === "callback" && type.value.parameters.length === 0;
};

const isRefusedTransfer = (
    context: ModuleContext,
    ref: TypeId | undefined,
    transfer: ParameterTransfer,
): boolean => {
    if (ref === undefined || transferOwnership(transfer) !== "full") {
        return false;
    }

    const type = underlyingType(context, ref);

    return type?.kind === "record" && isPlainStruct(type);
};

const isLentInPlace = (context: ModuleContext, parameter: GirParameter): boolean =>
    isCallerAllocatedOut(parameter) || isRecordInout(context, parameter);

const isRefusedParamTransfer = (context: ModuleContext, parameter: GirParameter): boolean =>
    !isLentInPlace(context, parameter) && isRefusedTransfer(context, parameter.type, parameter.transferOwnership);

const isUnmarshalableCallParam = (context: ModuleContext, parameter: GirParameter): boolean => {
    if (parameter.isVarargs) {
        return false;
    }

    if (isTypeErasedCallback(context, parameter) || isRefusedParamTransfer(context, parameter)) {
        return true;
    }

    if (parameter.direction === "in") {
        return false;
    }

    if (isCallerAllocatedOut(parameter)) {
        return isUnmarshalableCallerOut(context, parameter);
    }

    return hasIndirectionMismatch(context, parameter);
};

const hasUnmarshalableParam = (context: ModuleContext, callable: UnmarshalableSubject): boolean =>
    (callable.instance !== undefined && isRefusedParamTransfer(context, callable.instance)) ||
    isRefusedTransfer(context, callable.returnValue.type, callable.returnValue.transferOwnership) ||
    callable.parameters.some((parameter) => isUnmarshalableCallParam(context, parameter));

export { hasUnmarshalableParam };
