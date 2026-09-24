import type { Library } from "../gir/library.js";
import type { GirParameter } from "../gir/parameter.js";
import type { CArrayType, ListType, TypeId } from "../gir/type-id.js";
import { isUnboundedArray, underlyingType } from "./type-shape.js";

type ArrayType = CArrayType | ListType;

const arrayTypeFor = (library: Library, ref: TypeId | undefined): ArrayType | undefined => {
    const type = underlyingType(library, ref);

    if (type?.kind === "carray" || (type?.kind === "list" && type.flavor !== "gbytearray")) {
        return type;
    }

    return undefined;
};

const hasArrayItem = (library: Library, type: ArrayType): boolean => {
    const item = underlyingType(library, type.element);

    return item?.kind === "carray" || item?.kind === "list";
};

const hasUnsupportedNestedArrayInput = (library: Library, ref: TypeId | undefined): boolean => {
    const type = arrayTypeFor(library, ref);

    return type !== undefined && hasArrayItem(library, type);
};

const hasUnsupportedNestedArrayOutput = (library: Library, ref: TypeId | undefined): boolean => {
    const type = arrayTypeFor(library, ref);

    if (type === undefined || !hasArrayItem(library, type)) {
        return false;
    }

    return type.kind === "carray" ? !isUnboundedArray(type) : type.flavor === "garray";
};

const hasUnsupportedNestedArrayParameter = (library: Library, parameter: GirParameter): boolean =>
    (parameter.direction !== "out" && hasUnsupportedNestedArrayInput(library, parameter.type)) ||
    (parameter.direction !== "in" && hasUnsupportedNestedArrayOutput(library, parameter.type));

export {
    hasUnsupportedNestedArrayOutput,
    hasUnsupportedNestedArrayParameter,
};
