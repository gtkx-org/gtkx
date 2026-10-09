import type { Library } from "../gir/library.js";
import type { GirParameter } from "../gir/parameter.js";
import { cTypePointerDepth, underlyingType } from "./type-shape.js";

const inoutHandleIndirection = (library: Library, parameter: GirParameter): number | undefined => {
    if (parameter.direction !== "inout") {
        return undefined;
    }

    const kind = underlyingType(library, parameter.type)?.kind;

    if (kind === undefined || !["class", "interface", "record"].includes(kind)) {
        return undefined;
    }

    return cTypePointerDepth(parameter.cType) === 2 ? 2 : 1;
};

const hasInoutHandleIndirectionMismatch = (library: Library, parameter: GirParameter): boolean => {
    const expected = inoutHandleIndirection(library, parameter);

    return expected !== undefined && parameter.cType !== undefined && cTypePointerDepth(parameter.cType) !== expected;
};

export { hasInoutHandleIndirectionMismatch, inoutHandleIndirection };
