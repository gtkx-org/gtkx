import type { Library } from "../gir/library.js";
import type { GirCallable, GirParameter } from "../gir/parameter.js";
import type { TypeId } from "../gir/type-id.js";
import { isOutParameter } from "../gir/parameter.js";

const BYTE_CATEGORIES: Set<string> = new Set(["int8", "uint8"]);
const CHAR_POINTER = /char\s*\*/;

const isByteElement = (library: Library, element: TypeId): boolean => {
    const type = library.typeFor(element);

    return type?.kind === "primitive" && BYTE_CATEGORIES.has(type.category);
};

const isNulTerminatedBytes = (library: Library, ref: TypeId | undefined): boolean => {
    const type = ref === undefined ? undefined : library.typeFor(ref);

    if (type?.kind !== "carray" || type.arrayCType === undefined || !CHAR_POINTER.test(type.arrayCType)) {
        return false;
    }

    const isUnbounded =
        type.isZeroTerminated && type.lengthParameterIndex === undefined && type.fixedSize === undefined;

    return isUnbounded && isByteElement(library, type.element);
};

const nulTerminatedByteParams = (library: Library, callable: GirCallable): GirParameter[] =>
    callable.parameters.filter(
        (parameter) => !isOutParameter(parameter) && isNulTerminatedBytes(library, parameter.type),
    );

export { isNulTerminatedBytes, nulTerminatedByteParams };
