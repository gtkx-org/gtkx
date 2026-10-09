import type { Library } from "../gir/library.js";
import type { GirParameter, ParameterTransfer } from "../gir/parameter.js";
import type { TypeId } from "../gir/type-id.js";
import { isInoutParameter, isOutParameter } from "../gir/parameter.js";
import {
    carrayFor,
    cTypePointerDepth,
    hasPrimitivePointer,
    hasScalarPointer,
    isScalarRef,
    primitiveCategoryThroughAliases,
    underlyingType,
} from "./type-shape.js";

const isOpaquePointer = (library: Library, type: TypeId | undefined): boolean =>
    primitiveCategoryThroughAliases(library, type) === "pointer";

const hasUnsupportedOpaquePointer = (
    library: Library,
    type: TypeId | undefined,
    transfer: ParameterTransfer,
): boolean => {
    if (isOpaquePointer(library, type)) return transfer !== "none";
    const resolved = underlyingType(library, type);
    if (
        (resolved?.kind === "carray" || (resolved?.kind === "list" && resolved.flavor !== "garray")) &&
        isOpaquePointer(library, resolved.element)
    )
        return transfer === "full";
    return hasPrimitivePointer(library, type);
};

const isPointerValueParameter = (library: Library, parameter: GirParameter): boolean =>
    parameter.direction === "in" &&
    !isOpaquePointer(library, parameter.type) &&
    isScalarRef(library, parameter.type) &&
    /^(?:gpointer|gconstpointer)$/u.test(parameter.cType ?? "");

const isIndirectScalarParameter = (library: Library, parameter: GirParameter): boolean => {
    if (
        isOpaquePointer(library, parameter.type) ||
        !isScalarRef(library, parameter.type) ||
        isPointerValueParameter(library, parameter)
    )
        return false;
    const depth = cTypePointerDepth(parameter.cType);
    return parameter.direction === "in" ? depth === 1 : parameter.direction === "out" && depth === 2;
};

const isIndirectScalarReturn = (library: Library, type: TypeId | undefined, cType: string | undefined): boolean =>
    !isOpaquePointer(library, type) && isScalarRef(library, type) && cTypePointerDepth(cType) === 1;

const hasUnsupportedScalarParameter = (library: Library, parameter: GirParameter): boolean => {
    if (isOpaquePointer(library, parameter.type)) {
        return parameter.direction !== "in" || parameter.transferOwnership !== "none";
    }
    if (isIndirectScalarParameter(library, parameter) || isPointerValueParameter(library, parameter)) return false;
    const hasOutIndirection =
        isOutParameter(parameter) || (isInoutParameter(parameter) && carrayFor(library, parameter.type) !== undefined);

    if (hasScalarPointer(library, parameter.type, undefined, hasOutIndirection)) return true;
    if (!isScalarRef(library, parameter.type) || parameter.cType === undefined) return false;
    const pointers = cTypePointerDepth(parameter.cType);
    const expected = isOutParameter(parameter) || isInoutParameter(parameter) ? 1 : 0;
    return pointers !== expected;
};

export {
    hasUnsupportedScalarParameter,
    isIndirectScalarParameter,
    isPointerValueParameter,
    isOpaquePointer,
    hasUnsupportedOpaquePointer,
    isIndirectScalarReturn,
};
