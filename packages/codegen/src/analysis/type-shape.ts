import type { Library } from "../gir/library.js";
import type { CArrayType, ListType, TypeId } from "../gir/type-id.js";
import type { GirType } from "../gir/type.js";
import { primitiveCategory, type PrimitiveCategory } from "../gir/primitives.js";
import { hasUnknownArrayLength } from "../gir/type-id.js";

const resolvedTypeFor = (library: Library, ref: TypeId | undefined): GirType | undefined =>
    ref === undefined ? undefined : library.typeFor(ref);

const underlyingType = (library: Library, ref: TypeId | undefined): GirType | undefined => {
    const type = resolvedTypeFor(library, ref);

    return type?.kind === "alias" ? underlyingType(library, type.value.target) : type;
};

const isScalarRef = (library: Library, ref: TypeId | undefined): boolean => {
    const type = underlyingType(library, ref);

    return type?.kind === "enum" ||
        (type?.kind === "primitive" && type.category !== "string" && type.category !== "void");
};

const carrayFor = (library: Library, ref: TypeId | undefined): CArrayType | undefined => {
    const type = resolvedTypeFor(library, ref);

    return type?.kind === "carray" ? type : undefined;
};

const primitiveCategoryFor = (library: Library, ref: TypeId | undefined): PrimitiveCategory | undefined => {
    const type = resolvedTypeFor(library, ref);

    return type?.kind === "primitive" ? type.category : undefined;
};

const primitiveCategoryThroughAliases = (library: Library, ref: TypeId | undefined): PrimitiveCategory | undefined => {
    const type = resolvedTypeFor(library, ref);

    if (type?.kind !== "alias") {
        return primitiveCategoryFor(library, ref);
    }

    const category = type.value.cType === undefined ? undefined : primitiveCategory(type.value.cType);

    return category === "gtype" ? category : primitiveCategoryThroughAliases(library, type.value.target);
};

const isUnboundedArray = (type: CArrayType): boolean =>
    type.isZeroTerminated && type.lengthParameterIndex === undefined && type.fixedSize === undefined;

const isByteSequence = (library: Library, type: CArrayType | ListType): boolean =>
    type.kind === "list" ? type.flavor === "gbytearray" : primitiveCategoryFor(library, type.element) === "uint8";

const hasTypeMatching = (
    library: Library,
    ref: TypeId | undefined,
    isMatch: (type: GirType) => boolean,
): boolean => {
    const type = resolvedTypeFor(library, ref);

    if (type !== undefined && isMatch(type)) {
        return true;
    }

    switch (type?.kind) {
        case "alias": {
            return hasTypeMatching(library, type.value.target, isMatch);
        }
        case "carray":
        case "list": {
            return !isByteSequence(library, type) && hasTypeMatching(library, type.element, isMatch);
        }
        case "hashtable": {
            return hasTypeMatching(library, type.key, isMatch) || hasTypeMatching(library, type.value, isMatch);
        }
        case undefined:
        case "class":
        case "interface":
        case "record":
        case "callback":
        case "primitive":
        case "varargs":
        case "enum": {
            return false;
        }
    }
};

const cTypePointerDepth = (cType: string | undefined): number =>
    (cType?.split("*").length ?? 1) - 1 + (/\bg(?:const)?pointer\b/u.test(cType ?? "") ? 1 : 0);

const hasScalarPointer = (
    library: Library,
    ref: TypeId | undefined,
    cType?: string,
    hasOutIndirection = false,
): boolean => {
    const outerArray = hasOutIndirection ? underlyingType(library, ref) : undefined;

    return (isScalarRef(library, ref) && cTypePointerDepth(cType) > 0) ||
        hasTypeMatching(library, ref, (type) => {
            if (type.kind === "alias") {
                return isScalarRef(library, type.value.target) &&
                    (cTypePointerDepth(type.value.cType) > 0 || cTypePointerDepth(type.value.targetCType) > 0);
            }

            if (type.kind !== "carray" || !isScalarRef(library, type.element)) {
                return false;
            }

            const pointers = cTypePointerDepth(type.elementCType);

            return pointers > (type === outerArray ? 1 : 0);
        });
};

const hasPrimitivePointer = (library: Library, ref: TypeId | undefined): boolean =>
    hasTypeMatching(library, ref, (type) => type.kind === "primitive" && type.category === "pointer");

const hasUnknownLengthArray = (library: Library, ref: TypeId | undefined): boolean =>
    hasTypeMatching(library, ref, (type) => type.kind === "carray" && hasUnknownArrayLength(type));

export {
    carrayFor,
    cTypePointerDepth,
    hasScalarPointer,
    isScalarRef,
    hasUnknownLengthArray,
    hasTypeMatching,
    hasPrimitivePointer,
    isByteSequence,
    isUnboundedArray,
    primitiveCategoryFor,
    primitiveCategoryThroughAliases,
    underlyingType,
};
