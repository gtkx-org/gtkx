import type { Library } from "../gir/library.js";
import type { GirAlias } from "../gir/namespace.js";
import { isEmittableEntity } from "../gir/emittable.js";
import { hasUnsupportedCallback } from "./callback-shape.js";
import { isOpaquePointer } from "./scalar-pointer.js";
import { hasScalarPointer, hasUnknownLengthArray } from "./type-shape.js";

const isEmittableAlias = (library: Library, alias: GirAlias): boolean =>
    isEmittableEntity(alias) &&
    !hasUnsupportedCallback(library, alias.target) &&
    !hasUnknownLengthArray(library, alias.target) &&
    (isOpaquePointer(library, alias.target) ||
        (!hasScalarPointer(library, alias.target, alias.cType) &&
            !hasScalarPointer(library, alias.target, alias.targetCType)));

export { isEmittableAlias };
