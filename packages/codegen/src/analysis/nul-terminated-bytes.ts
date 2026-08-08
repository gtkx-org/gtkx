import type { Library } from "../gir/library.js";
import type { GirCallable, GirParameter } from "../gir/parameter.js";
import type { TypeId } from "../gir/type-id.js";
import { isOutParameter } from "../gir/parameter.js";
import { carrayFor, isUnboundedArray, primitiveCategoryFor } from "./type-shape.js";

const BYTE_CATEGORIES: Set<string> = new Set(["int8", "uint8"]);
const CHAR_POINTER = /char\s*\*/;

const isByteElement = (library: Library, element: TypeId): boolean => {
    const category = primitiveCategoryFor(library, element);

    return category !== undefined && BYTE_CATEGORIES.has(category);
};

const isNulTerminatedBytes = (library: Library, ref: TypeId | undefined): boolean => {
    const type = carrayFor(library, ref);

    if (type?.arrayCType === undefined || !CHAR_POINTER.test(type.arrayCType)) {
        return false;
    }

    return isUnboundedArray(type) && isByteElement(library, type.element);
};

const nulTerminatedByteParams = (library: Library, callable: GirCallable): GirParameter[] =>
    callable.parameters.filter(
        (parameter) => !isOutParameter(parameter) && isNulTerminatedBytes(library, parameter.type),
    );

export { nulTerminatedByteParams };
