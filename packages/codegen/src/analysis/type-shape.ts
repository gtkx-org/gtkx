import type { Library } from "../gir/library.js";
import type { PrimitiveCategory } from "../gir/primitives.js";
import type { CArrayType, ListType, TypeId } from "../gir/type-id.js";
import type { GirType } from "../gir/type.js";

const resolvedTypeFor = (library: Library, ref: TypeId | undefined): GirType | undefined =>
    ref === undefined ? undefined : library.typeFor(ref);

const carrayFor = (library: Library, ref: TypeId | undefined): CArrayType | undefined => {
    const type = resolvedTypeFor(library, ref);

    return type?.kind === "carray" ? type : undefined;
};

const primitiveCategoryFor = (library: Library, ref: TypeId | undefined): PrimitiveCategory | undefined => {
    const type = resolvedTypeFor(library, ref);

    return type?.kind === "primitive" ? type.category : undefined;
};

const isUnboundedArray = (type: CArrayType): boolean =>
    type.isZeroTerminated && type.lengthParameterIndex === undefined && type.fixedSize === undefined;

const isByteSequence = (library: Library, type: CArrayType | ListType): boolean =>
    type.kind === "list" ? type.flavor === "gbytearray" : primitiveCategoryFor(library, type.element) === "uint8";

export { carrayFor, isByteSequence, isUnboundedArray, primitiveCategoryFor };
