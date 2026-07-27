import { sourceStringLiteral } from "@gtkx/utils";
import type { GirConstant } from "../../gir/namespace.js";
import type { PrimitiveCategory } from "../../gir/primitives.js";
import type { TypeId } from "../../gir/type-id.js";
import type { ModuleContext } from "../../writer/context.js";
import { renderJsDoc } from "../../writer/doc.js";

const TRUE_VALUES: Set<string> = new Set(["true", "1"]);

const generateConstant = (context: ModuleContext, constant: GirConstant): void => {
    context.module.appendDeclaration(
        `${renderJsDoc(constant.doc)}export const ${constant.name} = ${constantLiteral(context, constant)};`,
    );
};

const constantLiteral = (context: ModuleContext, constant: GirConstant): string => {
    if (hasPrimitiveCategory(context, constant.type, "string")) {
        return sourceStringLiteral(constant.value);
    }

    if (hasPrimitiveCategory(context, constant.type, "boolean")) {
        return TRUE_VALUES.has(constant.value) ? "true" : "false";
    }

    return isNumericLiteral(constant.value) ? constant.value : sourceStringLiteral(constant.value);
};

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
