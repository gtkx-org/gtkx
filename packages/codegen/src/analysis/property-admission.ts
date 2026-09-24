import type { Library } from "../gir/library.js";
import type { GirProperty } from "../gir/property.js";
import { hasPrimitivePointer, hasScalarPointer, hasUnknownLengthArray } from "./type-shape.js";

const isEmittableProperty = (library: Library, property: GirProperty): boolean =>
    property.introspectable && !hasPrimitivePointer(library, property.type) &&
    !hasUnknownLengthArray(library, property.type) && !hasScalarPointer(library, property.type);

export { isEmittableProperty };
