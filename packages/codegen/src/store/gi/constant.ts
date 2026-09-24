import { sanitizeIdentifier, sourceStringLiteral } from "@gtkx/utils";
import type { Library } from "../../gir/library.js";
import type { GirConstant } from "../../gir/namespace.js";
import type { PrimitiveCategory } from "../../gir/primitives.js";
import type { ModuleContext } from "../../writer/context.js";
import {
    hasPrimitivePointer,
    hasScalarPointer,
    primitiveCategoryThroughAliases,
} from "../../analysis/type-shape.js";
import { isEmittableEntity } from "../../gir/emittable.js";
import { getDoc } from "./doc-spec.js";

const TRUE_VALUES: Set<string> = new Set(["true", "1"]);
const BIGINT_CATEGORIES: Set<PrimitiveCategory> = new Set(["bigint64", "biguint64", "gtype"]);

const isEmittableConstant = (library: Library, constant: GirConstant): boolean =>
    isEmittableEntity(constant) &&
    !hasPrimitivePointer(library, constant.type) &&
    !hasScalarPointer(library, constant.type, constant.cType);

const generateConstant = (context: ModuleContext, constant: GirConstant): void => {
    if (!isEmittableConstant(context.library, constant)) {
        return;
    }

    const doc = getDoc(constant);
    const name = sanitizeIdentifier(constant.name);

    context.declare({
        name,
        code: `${doc}export const ${name} = ${constantLiteral(context, constant)};`,
    });
};

const constantLiteral = (context: ModuleContext, constant: GirConstant): string => {
    const category = primitiveCategoryThroughAliases(context.library, constant.type);

    if (category === "string") {
        return sourceStringLiteral(constant.value);
    }

    if (category === "boolean") {
        return TRUE_VALUES.has(constant.value.trim()) ? "true" : "false";
    }

    return numericConstantLiteral(constant, category);
};

const numericConstantLiteral = (constant: GirConstant, category: PrimitiveCategory | undefined): string => {
    const value = constant.value.trim();

    if (!isNumericLiteral(value)) {
        return sourceStringLiteral(value);
    }

    return category !== undefined && BIGINT_CATEGORIES.has(category) ? `${value}n` : value;
};

const isNumericLiteral = (value: string): boolean => /^-?(?:\d+|\d*\.\d+)$/.test(value);

export { generateConstant, constantLiteral, isEmittableConstant };
