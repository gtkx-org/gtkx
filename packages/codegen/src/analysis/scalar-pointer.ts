import type { Library } from "../gir/library.js";
import type { GirParameter } from "../gir/parameter.js";
import { isInoutParameter, isOutParameter } from "../gir/parameter.js";
import { carrayFor, cTypePointerDepth, hasScalarPointer, isScalarRef } from "./type-shape.js";

const hasUnsupportedScalarParameter = (library: Library, parameter: GirParameter): boolean => {
    const hasOutIndirection = isOutParameter(parameter) ||
        (isInoutParameter(parameter) && carrayFor(library, parameter.type) !== undefined);

    if (hasScalarPointer(library, parameter.type, undefined, hasOutIndirection)) {
        return true;
    }

    if (!isScalarRef(library, parameter.type) || parameter.cType === undefined) {
        return false;
    }

    const pointers = cTypePointerDepth(parameter.cType);
    const expected = isOutParameter(parameter) || isInoutParameter(parameter) ? 1 : 0;

    return pointers !== expected;
};

export { hasUnsupportedScalarParameter };
