import type { GirFunction } from "../gir/function.js";
import type { GirParameter, ParameterTransfer } from "../gir/parameter.js";
import type { CArrayType, TypeId } from "../gir/type-id.js";
import type { GirType } from "../gir/type.js";
import type { ModuleContext } from "../writer/context.js";
import { EXTERNAL_RECORD_COPY_STRATEGIES } from "../gir/external-namespaces.js";
import { isCallerAllocatedOut } from "../gir/parameter.js";
import { isBoxedRecord } from "../gir/record.js";
import { isValueMarshalable } from "../store/gi/value-marshalable.js";
import { itemComparatorParameters } from "../store/gi/item-comparators.js";
import {
    isCollectibleCallerOut,
    isFixedArrayCallerOut,
    isSizedArrayCallerOut,
    isGArrayCallerOut,
    isHandlePassedInPlace,
    isRecordInout,
} from "../store/gi/param-marshal.js";
import { recordInlineSize } from "../store/gi/record-layout.js";
import { runtimeOverrideFor } from "../store/gi/runtime-override.js";
import { hasCallbackType, isSupportedCallback } from "./callback-shape.js";
import { isUnownableStruct, transferOwnership } from "./descriptor-render.js";
import { hasTransferredNumericHashTableInput, hasUnsupportedHashTableSlot } from "./hash-table-admission.js";
import { hasUnsupportedInlineRecordArray } from "./inline-record-array-admission.js";
import { inoutHandleIndirection } from "./inout-handle.js";
import { byValueRecordAbi } from "./record-value-abi.js";
import { hasUnsupportedNestedArrayOutput, hasUnsupportedNestedArrayParameter } from "./nested-array-admission.js";
import { closureAndDestroyIndices } from "./param-structure.js";
import {
    hasUnsupportedScalarParameter,
    hasUnsupportedOpaquePointer,
    isOpaquePointer,
    isIndirectScalarParameter,
    isPointerValueParameter,
} from "./scalar-pointer.js";
import {
    cTypePointerDepth,
    hasScalarPointer,
    hasUnknownLengthArray,
    isScalarRef,
    underlyingType,
} from "./type-shape.js";

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

    const type = underlyingType(context.library, element);

    return type !== undefined && isPointerType(context, type);
};

const carrayIndirection = (context: ModuleContext, type: CArrayType, hasOutIndirection: boolean): number => {
    const element = underlyingType(context.library, type.element);
    if (element?.kind === "carray") {
        return POINTER_DEPTH + carrayIndirection(context, element, false);
    }

    const isRecordPointer =
        element?.kind === "record" && cTypePointerDepth(type.elementCType) > Number(hasOutIndirection);

    return POINTER_DEPTH + (isRecordPointer || isPointerElement(context, type.element) ? POINTER_DEPTH : 0);
};

const typeIndirection = (context: ModuleContext, type: GirType, hasOutIndirection: boolean): number | undefined => {
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
            return carrayIndirection(context, type, hasOutIndirection);
        }
        case "alias":
        case "enum":
        case "varargs": {
            return undefined;
        }
    }
};

const baseIndirection = (
    context: ModuleContext,
    ref: TypeId | undefined,
    hasOutIndirection: boolean,
): number | undefined => {
    if (isScalarRef(context.library, ref)) {
        return 0;
    }

    const type = ref === undefined ? undefined : underlyingType(context.library, ref);

    return type === undefined ? undefined : typeIndirection(context, type, hasOutIndirection);
};

const declaredIndirection = (parameter: GirParameter): number | undefined => {
    const cType = parameter.cType;

    if (cType === undefined) {
        return undefined;
    }

    return cTypePointerDepth(cType);
};

const marshalledIndirection = (context: ModuleContext, parameter: GirParameter): number | undefined => {
    const handleDepth = inoutHandleIndirection(context.library, parameter);

    if (handleDepth !== undefined) {
        return handleDepth;
    }

    const isPassedInPlace = isCallerAllocatedOut(parameter) || isHandlePassedInPlace(context, parameter);
    const base = baseIndirection(context, parameter.type, parameter.direction !== "in" && !isPassedInPlace);

    if (base === undefined) {
        return undefined;
    }

    if (isPassedInPlace) {
        return base;
    }

    return base + POINTER_DEPTH;
};

const hasCallerSuppliedLength = (context: ModuleContext, parameter: GirParameter): boolean => {
    const type = parameter.type === undefined ? undefined : underlyingType(context.library, parameter.type);

    return type?.kind === "carray" && type.lengthParameterIndex !== undefined;
};

const isUnmarshalableCallerOut = (context: ModuleContext, parameter: GirParameter): boolean => {
    if (hasCallerSuppliedLength(context, parameter) && !isSizedArrayCallerOut(context, parameter)) {
        return true;
    }

    if (
        isFixedArrayCallerOut(context, parameter) ||
        isSizedArrayCallerOut(context, parameter) ||
        isGArrayCallerOut(context, parameter)
    ) {
        return false;
    }

    return !isCollectibleCallerOut(context, parameter) && !parameter.optional;
};

const hasIndirectionMismatch = (context: ModuleContext, parameter: GirParameter): boolean => {
    if (isIndirectScalarParameter(context.library, parameter) || isPointerValueParameter(context.library, parameter))
        return false;
    const declared = declaredIndirection(parameter);
    const marshalled = marshalledIndirection(context, parameter);

    if (declared === undefined || marshalled === undefined) {
        return false;
    }

    return declared !== marshalled;
};

const hasDetachedClosure = (parameter: GirParameter, index: number): boolean => {
    const userDataIndex = parameter.closureIndex;

    if (userDataIndex !== undefined && userDataIndex !== index + 1) {
        return true;
    }

    const notifyIndex = parameter.destroyIndex;

    return notifyIndex !== undefined && notifyIndex !== index + (userDataIndex === undefined ? 1 : 2);
};

const isRefusedTransfer = (context: ModuleContext, ref: TypeId | undefined, transfer: ParameterTransfer): boolean => {
    if (ref === undefined || transferOwnership(transfer) !== "full") {
        return false;
    }

    const type = underlyingType(context.library, ref);

    return type?.kind === "record" && isUnownableStruct(context, type);
};

const isLentInPlace = (context: ModuleContext, parameter: GirParameter): boolean =>
    isCallerAllocatedOut(parameter) || isRecordInout(context, parameter);

const isRefusedParamTransfer = (context: ModuleContext, parameter: GirParameter): boolean => {
    if (isLentInPlace(context, parameter) || transferOwnership(parameter.transferOwnership) !== "full") {
        return false;
    }

    const type = underlyingType(context.library, parameter.type);
    const hasNoCopy =
        type?.kind === "record" &&
        !isBoxedRecord(type.value) &&
        type.value.freeFunc !== undefined &&
        type.value.copyFunc === undefined &&
        !EXTERNAL_RECORD_COPY_STRATEGIES.has(type.value.cType ?? "") &&
        !isValueMarshalable(context, type.namespace.name, type.value);

    return hasNoCopy || isRefusedTransfer(context, parameter.type, parameter.transferOwnership);
};

const bareCTypeSpelling = (spelling: string): string => spelling.replaceAll(/\bconst\b/gu, "").replaceAll(/\s+/gu, "");

const isByValueRecord = (context: ModuleContext, ref: TypeId | undefined, cType: string | undefined): boolean => {
    if (ref === undefined || cType === undefined || cType.includes("*")) {
        return false;
    }

    const type = underlyingType(context.library, ref);

    if (type?.kind !== "record") {
        return false;
    }

    const declared = type.value.cType;

    if (declared === undefined) {
        return false;
    }

    return (
        bareCTypeSpelling(declared) === bareCTypeSpelling(cType) && recordInlineSize(context, type.value) !== undefined
    );
};

const isUnmarshalableCallParam = (context: ModuleContext, parameter: GirParameter): boolean => {
    if (parameter.isVarargs) {
        return false;
    }

    if (isRefusedParamTransfer(context, parameter)) {
        return true;
    }

    if (
        isByValueRecord(context, parameter.type, parameter.cType) &&
        (parameter.direction !== "in" ||
            transferOwnership(parameter.transferOwnership) !== "borrowed" ||
            byValueRecordAbi(context, parameter.type, parameter.cType) === undefined)
    ) {
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

const hasUnsupportedCallbackParam = (
    context: ModuleContext,
    callable: GirFunction,
    parameter: GirParameter,
): boolean => {
    const type = underlyingType(context.library, parameter.type);

    if (type?.kind !== "callback" || parameter.direction !== "in") {
        return hasCallbackType(context.library, parameter.type);
    }

    return !isSupportedCallback(context.library, type.value, itemComparatorParameters(context, callable, parameter));
};

const hasAsyncCallback = (context: ModuleContext, callable: GirFunction): boolean =>
    callable.parameters.some(
        (parameter) =>
            parameter.direction === "in" &&
            parameter.scope === "async" &&
            underlyingType(context.library, parameter.type)?.kind === "callback",
    );

const hasUnsupportedInlineRecordArrayParameter = (
    context: ModuleContext,
    callable: GirFunction,
    parameter: GirParameter,
): boolean => {
    const hasOutIndirection = parameter.direction !== "in" && !isCallerAllocatedOut(parameter);

    if (
        parameter.direction !== "out" &&
        hasUnsupportedInlineRecordArray(context, parameter.type, parameter.transferOwnership, {
            direction: "to-native",
            hasOutIndirection,
            isCallerAllocated: parameter.direction === "inout",
            isRetained: hasAsyncCallback(context, callable),
        })
    ) {
        return true;
    }

    return (
        parameter.direction !== "in" &&
        hasUnsupportedInlineRecordArray(context, parameter.type, parameter.transferOwnership, {
            direction: "from-native",
            hasOutIndirection,
            isCallerAllocated: parameter.callerAllocates || parameter.direction === "inout",
        })
    );
};

const hasUnboundPointer = (context: ModuleContext, callable: GirFunction): boolean => {
    if (runtimeOverrideFor(callable) !== undefined) {
        return false;
    }

    if (
        hasUnsupportedHashTableSlot(context.library, callable.returnValue.type) ||
        hasUnsupportedHashTableSlot(context.library, callable.instance?.type) ||
        hasUnsupportedNestedArrayOutput(context.library, callable.returnValue.type) ||
        (!isOpaquePointer(context.library, callable.returnValue.type) &&
            hasScalarPointer(context.library, callable.returnValue.type, callable.returnValue.cType)) ||
        hasUnknownLengthArray(context.library, callable.returnValue.type) ||
        hasUnknownLengthArray(context.library, callable.instance?.type) ||
        hasUnsupportedOpaquePointer(
            context.library,
            callable.returnValue.type,
            callable.returnValue.transferOwnership,
        ) ||
        hasUnsupportedOpaquePointer(context.library, callable.instance?.type, "none") ||
        hasCallbackType(context.library, callable.returnValue.type) ||
        hasUnsupportedInlineRecordArray(context, callable.returnValue.type, callable.returnValue.transferOwnership, {
            direction: "from-native",
        })
    ) {
        return true;
    }

    const claimed = closureAndDestroyIndices(callable);

    return callable.parameters.some(
        (parameter, index) =>
            !claimed.has(index) &&
            (hasUnsupportedHashTableSlot(context.library, parameter.type) ||
                hasTransferredNumericHashTableInput(context.library, parameter) ||
                hasUnsupportedNestedArrayParameter(context.library, parameter) ||
                hasUnsupportedScalarParameter(context.library, parameter) ||
                (parameter.direction !== "in" && hasUnknownLengthArray(context.library, parameter.type)) ||
                hasUnsupportedOpaquePointer(context.library, parameter.type, parameter.transferOwnership) ||
                hasUnsupportedInlineRecordArrayParameter(context, callable, parameter) ||
                hasUnsupportedCallbackParam(context, callable, parameter)),
    );
};

const hasUnmarshalableParam = (context: ModuleContext, callable: GirFunction): boolean => {
    if (
        callable.instance !== undefined &&
        (hasTransferredNumericHashTableInput(context.library, callable.instance) ||
            hasUnsupportedScalarParameter(context.library, callable.instance) ||
            isRefusedParamTransfer(context, callable.instance))
    ) {
        return true;
    }

    return (
        hasUnboundPointer(context, callable) ||
        isRefusedTransfer(context, callable.returnValue.type, callable.returnValue.transferOwnership) ||
        isByValueRecord(context, callable.returnValue.type, callable.returnValue.cType) ||
        (hasAsyncCallback(context, callable) &&
            callable.parameters.some((parameter) => isByValueRecord(context, parameter.type, parameter.cType))) ||
        callable.parameters.some((parameter) => isUnmarshalableCallParam(context, parameter))
    );
};

export { hasDetachedClosure, hasUnmarshalableParam };
