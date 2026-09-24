import type { Library } from "../gir/library.js";
import type { GirParameter } from "../gir/parameter.js";
import { cTypePointerDepth, underlyingType } from "./type-shape.js";

const inoutHandleIndirection = (library: Library, parameter: GirParameter): number | undefined => {
    if (parameter.direction !== "inout") {
        return undefined;
    }

    const kind = underlyingType(library, parameter.type)?.kind;

    return kind !== undefined && ["class", "interface", "record"].includes(kind) ? 1 : undefined;
};

const hasInoutHandleIndirectionMismatch = (library: Library, parameter: GirParameter): boolean => {
    const expected = inoutHandleIndirection(library, parameter);

    return expected !== undefined && parameter.cType !== undefined &&
        cTypePointerDepth(parameter.cType) !== expected;
};

export { hasInoutHandleIndirectionMismatch, inoutHandleIndirection };
