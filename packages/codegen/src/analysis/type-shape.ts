import type { Library } from "../gir/library.js";
import type { CArrayType, ListType, TypeId } from "../gir/type-id.js";
import type { GirType } from "../gir/type.js";
import { primitiveCategory, type PrimitiveCategory } from "../gir/primitives.js";

const resolvedTypeFor = (library: Library, ref: TypeId | undefined): GirType | undefined =>
    ref === undefined ? undefined : library.typeFor(ref);

const underlyingType = (library: Library, ref: TypeId | undefined): GirType | undefined => {
    const type = resolvedTypeFor(library, ref);

    return type?.kind === "alias" ? underlyingType(library, type.value.target) : type;
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

export {
    carrayFor,
    isByteSequence,
    isUnboundedArray,
    primitiveCategoryFor,
    primitiveCategoryThroughAliases,
    underlyingType,
};
