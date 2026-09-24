import type { Library } from "../gir/library.js";
import type { GirCallable } from "../gir/parameter.js";
import type { TypeId } from "../gir/type-id.js";
import { hasCallbackType } from "./callback-shape.js";
import { hasUnsupportedScalarParameter } from "./scalar-pointer.js";
import { hasPrimitivePointer, hasScalarPointer, hasUnknownLengthArray } from "./type-shape.js";

const isSupportedSignalType = (library: Library, type: TypeId | undefined): boolean =>
    !hasPrimitivePointer(library, type) && !hasUnknownLengthArray(library, type) && !hasCallbackType(library, type);

const isEmittableSignal = (library: Library, signal: GirCallable): boolean =>
    signal.introspectable && isSupportedSignalType(library, signal.returnValue.type) &&
    !hasScalarPointer(library, signal.returnValue.type, signal.returnValue.cType) &&
    signal.parameters.every((parameter) =>
        isSupportedSignalType(library, parameter.type) && !hasUnsupportedScalarParameter(library, parameter));

export { isEmittableSignal };
