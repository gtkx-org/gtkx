import type { Library } from "../gir/library.js";
import { type GirParameter, isCallerAllocatedOut } from "../gir/parameter.js";
import { underlyingType } from "./type-shape.js";

const isCallerAllocatedContainer = (library: Library, parameter: GirParameter): boolean => {
    if (!isCallerAllocatedOut(parameter)) {
        return false;
    }

    const type = underlyingType(library, parameter.type);

    return type?.kind === "carray" || type?.kind === "list" || type?.kind === "hashtable";
};

export { isCallerAllocatedContainer };
