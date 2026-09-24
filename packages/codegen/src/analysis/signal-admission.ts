import type { Library } from "../gir/library.js";
import type { GirCallable } from "../gir/parameter.js";
import type { TypeId } from "../gir/type-id.js";
import { hasCallbackType } from "./callback-shape.js";
import { hasUnsupportedHashTableSlot } from "./hash-table-admission.js";
import { hasUnsupportedScalarParameter } from "./scalar-pointer.js";
import {
    hasPrimitivePointer,
    hasScalarPointer,
    hasUnknownLengthArray,
    isUnboundedArray,
    primitiveCategoryThroughAliases,
    underlyingType,
} from "./type-shape.js";

const isSupportedSignalType = (library: Library, type: TypeId | undefined): boolean =>
    !hasUnsupportedHashTableSlot(library, type) && !hasPrimitivePointer(library, type) &&
    !hasUnknownLengthArray(library, type) && !hasCallbackType(library, type);

const isEmittableSignal = (library: Library, signal: GirCallable): boolean =>
    signal.introspectable && isSupportedSignalType(library, signal.returnValue.type) &&
    !hasScalarPointer(library, signal.returnValue.type, signal.returnValue.cType) &&
    signal.parameters.every((parameter) =>
        isSupportedSignalType(library, parameter.type) && !hasUnsupportedScalarParameter(library, parameter));

const canEmitSignal = (library: Library, signal: GirCallable): boolean =>
    isEmittableSignal(library, signal) && signal.parameters.every((parameter) => {
        if (parameter.direction !== "in") {
            return true;
        }
        const type = underlyingType(library, parameter.type);

        return type?.kind !== "carray" ||
            (isUnboundedArray(type) && primitiveCategoryThroughAliases(library, type.element) === "string");
    });

export { canEmitSignal, isEmittableSignal };
