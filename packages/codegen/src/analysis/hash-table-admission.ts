import type { Library } from "../gir/library.js";
import type { PrimitiveCategory } from "../gir/primitives.js";
import type { TypeId } from "../gir/type-id.js";
import { deriveElementTransfer, type GirParameter, type ParameterTransfer } from "../gir/parameter.js";
import { hasTypeMatching, isByteSequence, underlyingType } from "./type-shape.js";

const BIGINT_CATEGORIES: ReadonlySet<PrimitiveCategory> = new Set(["bigint64", "biguint64", "gtype"]);
const NUMERIC_CELL_CATEGORIES: ReadonlySet<PrimitiveCategory> = new Set([
    ...BIGINT_CATEGORIES, "float32", "float64",
]);

const hasUnsupportedHashTableSlot = (library: Library, ref: TypeId | undefined): boolean =>
    hasTypeMatching(library, ref, (type) => {
        if (type.kind !== "hashtable") {
            return false;
        }

        const key = underlyingType(library, type.key);
        const value = underlyingType(library, type.value);

        return (key?.kind === "primitive" && BIGINT_CATEGORIES.has(key.category)) ||
            (value?.kind === "primitive" && value.category === "gtype");
    });

const hasNumericCell = (library: Library, ref: TypeId): boolean => {
    const type = underlyingType(library, ref);

    return type?.kind === "primitive" && NUMERIC_CELL_CATEGORIES.has(type.category);
};

const hasTransferredNumericHashTable = (
    library: Library,
    ref: TypeId | undefined,
    transfer: ParameterTransfer,
): boolean => {
    if (transfer === "none") {
        return false;
    }

    const type = underlyingType(library, ref);
    const elementTransfer = deriveElementTransfer(transfer);

    switch (type?.kind) {
        case "hashtable": {
            return hasNumericCell(library, type.key) || hasNumericCell(library, type.value) ||
                hasTransferredNumericHashTable(library, type.key, elementTransfer) ||
                hasTransferredNumericHashTable(library, type.value, elementTransfer);
        }
        case "carray":
        case "list": {
            return !isByteSequence(library, type) &&
                hasTransferredNumericHashTable(library, type.element, elementTransfer);
        }
        case undefined:
        case "class":
        case "interface":
        case "record":
        case "callback":
        case "alias":
        case "primitive":
        case "varargs":
        case "enum": {
            return false;
        }
    }
};

const hasTransferredNumericHashTableInput = (library: Library, parameter: GirParameter): boolean =>
    parameter.direction !== "out" &&
    hasTransferredNumericHashTable(library, parameter.type, parameter.transferOwnership);

export { hasTransferredNumericHashTable, hasTransferredNumericHashTableInput, hasUnsupportedHashTableSlot };
