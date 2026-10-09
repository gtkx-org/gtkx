import type { GirCallback } from "../gir/callback.js";
import type { Library } from "../gir/library.js";
import type { GirParameter } from "../gir/parameter.js";
import type { TypeId } from "../gir/type-id.js";
import { isCallerAllocatedContainer } from "./caller-allocated.js";
import { hasTransferredNumericHashTable, hasUnsupportedHashTableSlot } from "./hash-table-admission.js";
import {
    hasUnsupportedCallbackInlineRecordArray,
    hasUnsupportedInlineRecordArray,
} from "./inline-record-array-admission.js";
import { hasInoutHandleIndirectionMismatch } from "./inout-handle.js";
import {
    hasUnsupportedScalarParameter,
    hasUnsupportedOpaquePointer,
    isOpaquePointer,
    isIndirectScalarReturn,
} from "./scalar-pointer.js";
import { hasScalarPointer, hasTypeMatching, hasUnknownLengthArray, primitiveCategoryFor } from "./type-shape.js";

const userDataIndexByName = (library: Library, parameters: GirParameter[]): number | undefined => {
    let userDataIndex: number | undefined;

    for (const [index, parameter] of parameters.entries()) {
        const isNamedUserData = parameter.name === "user_data" || parameter.name === "data";

        if (isNamedUserData && primitiveCategoryFor(library, parameter.type) === "pointer") {
            userDataIndex = index;
        }
    }

    return userDataIndex;
};

const callbackUserDataIndex = (library: Library, parameters: GirParameter[]): number | undefined => {
    const declared = parameters.find((parameter) => parameter.closureIndex !== undefined);

    return declared?.closureIndex ?? userDataIndexByName(library, parameters);
};

const callbackIgnoredParameters = (library: Library, callback: GirCallback): ReadonlySet<GirParameter> => {
    const index = callbackUserDataIndex(library, callback.parameters);
    const parameter = index === undefined ? undefined : callback.parameters[index];

    return new Set(parameter === undefined ? [] : [parameter]);
};

const hasCallbackType = (library: Library, ref: TypeId | undefined): boolean =>
    hasTypeMatching(library, ref, (type) => type.kind === "callback");

const isSupportedCallback = (
    library: Library,
    callback: GirCallback,
    adaptedParameters: ReadonlySet<GirParameter> = new Set(),
): boolean => {
    if (
        !callback.introspectable ||
        hasUnsupportedHashTableSlot(library, callback.returnValue.type) ||
        hasTransferredNumericHashTable(library, callback.returnValue.type, callback.returnValue.transferOwnership) ||
        (!isOpaquePointer(library, callback.returnValue.type) &&
            !isIndirectScalarReturn(library, callback.returnValue.type, callback.returnValue.cType) &&
            hasScalarPointer(library, callback.returnValue.type, callback.returnValue.cType)) ||
        hasUnknownLengthArray(library, callback.returnValue.type) ||
        hasUnsupportedOpaquePointer(library, callback.returnValue.type, callback.returnValue.transferOwnership) ||
        hasCallbackType(library, callback.returnValue.type) ||
        hasUnsupportedInlineRecordArray(
            { library },
            callback.returnValue.type,
            callback.returnValue.transferOwnership,
            { direction: "to-native", isRetained: true },
        )
    ) {
        return false;
    }

    const ignored = callbackIgnoredParameters(library, callback);

    return callback.parameters.every(
        (parameter) =>
            ignored.has(parameter) ||
            adaptedParameters.has(parameter) ||
            ((parameter.direction === "in" ||
                !hasTransferredNumericHashTable(library, parameter.type, parameter.transferOwnership)) &&
                !isCallerAllocatedContainer(library, parameter) &&
                !hasInoutHandleIndirectionMismatch(library, parameter) &&
                !hasUnsupportedCallbackInlineRecordArray({ library }, parameter) &&
                !hasUnsupportedScalarParameter(library, parameter) &&
                !hasUnknownLengthArray(library, parameter.type) &&
                !hasUnsupportedOpaquePointer(library, parameter.type, parameter.transferOwnership) &&
                !hasUnsupportedHashTableSlot(library, parameter.type) &&
                !hasCallbackType(library, parameter.type)),
    );
};

const hasUnsupportedCallback = (library: Library, ref: TypeId | undefined): boolean =>
    hasTypeMatching(library, ref, (type) => type.kind === "callback" && !isSupportedCallback(library, type.value));

export {
    callbackIgnoredParameters,
    callbackUserDataIndex,
    hasCallbackType,
    hasUnsupportedCallback,
    isSupportedCallback,
};
