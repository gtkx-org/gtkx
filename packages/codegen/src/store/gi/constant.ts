import { sanitizeIdentifier, sourceStringLiteral } from "@gtkx/utils";
import type { GirConstant } from "../../gir/namespace.js";
import type { PrimitiveCategory } from "../../gir/primitives.js";
import type { TypeId } from "../../gir/type-id.js";
import type { ModuleContext } from "../../writer/context.js";
import { isEmittableEntity } from "../../gir/emittable.js";
import { getDoc } from "./doc-spec.js";

const TRUE_VALUES: Set<string> = new Set(["true", "1"]);
const BIGINT_CATEGORIES: Set<PrimitiveCategory> = new Set(["bigint64", "biguint64", "gtype", "pointer"]);

const generateConstant = (context: ModuleContext, constant: GirConstant): void => {
    if (!isEmittableEntity(constant)) {
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
    if (hasPrimitiveCategory(context, constant.type, "string")) {
        return sourceStringLiteral(constant.value);
    }

    if (hasPrimitiveCategory(context, constant.type, "boolean")) {
        return TRUE_VALUES.has(constant.value.trim()) ? "true" : "false";
    }

    return numericConstantLiteral(context, constant);
};

const numericConstantLiteral = (context: ModuleContext, constant: GirConstant): string => {
    const value = constant.value.trim();

    if (!isNumericLiteral(value)) {
        return sourceStringLiteral(value);
    }

    return isBigIntConstant(context, constant.type) ? `${value}n` : value;
};

const isBigIntConstant = (context: ModuleContext, type: TypeId | undefined): boolean =>
    [...BIGINT_CATEGORIES].some((category) => hasPrimitiveCategory(context, type, category));

const hasPrimitiveCategory = (
    context: ModuleContext,
    type: TypeId | undefined,
    category: PrimitiveCategory,
): boolean => {
    if (type === undefined) {
        return false;
    }

    const resolved = context.library.typeFor(type);

    return resolved?.kind === "primitive" && resolved.category === category;
};

const isNumericLiteral = (value: string): boolean => /^-?(?:\d+|\d*\.\d+)$/.test(value);

export { generateConstant, constantLiteral };
