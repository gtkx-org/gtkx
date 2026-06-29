import { sourceStringLiteral } from "@gtkx/utils";
import type { GirConstant } from "../../gir/namespace.js";
import type { TypeId } from "../../gir/type-id.js";
import type { ModuleContext } from "../../writer/context.js";

export const generateConstant = (context: ModuleContext, constant: GirConstant): void => {
    context.module.appendDeclaration(`export const ${constant.name} = ${constantLiteral(context, constant)};`);
};

const constantLiteral = (context: ModuleContext, constant: GirConstant): string => {
    if (isStringTyped(context, constant.type)) return sourceStringLiteral(constant.value);
    return isNumericLiteral(constant.value) ? constant.value : sourceStringLiteral(constant.value);
};

const isStringTyped = (context: ModuleContext, type: TypeId | undefined): boolean => {
    if (type === undefined) return false;
    const resolved = context.library.typeOf(type);
    return resolved?.kind === "primitive" && resolved.category === "string";
};

const isNumericLiteral = (value: string): boolean => /^-?(?:\d+|\d*\.\d+)$/.test(value);
