import { quote } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import type { GirConstant } from "../gir/namespace.js";
import type { TypeId } from "../gir/type-id.js";

/**
 * Emits an `export const NAME = value` declaration for a namespace constant.
 *
 * A constant whose declared type marshals to a string (`utf8` / `filename` /
 * `gchararray`) is always quoted — even when its value is all digits, as with
 * `G_CSET_DIGITS = "0123456789"`. Other constants keep the bare-numeral form
 * when the value is a plain number and are quoted otherwise.
 *
 * @param context - The module context
 * @param constant - The constant
 */
export const emitConstant = (context: ModuleContext, constant: GirConstant): void => {
    context.module.appendDeclaration(`export const ${constant.name} = ${constantLiteral(context, constant)};`);
};

const constantLiteral = (context: ModuleContext, constant: GirConstant): string => {
    if (isStringTyped(context, constant.type)) return quote(constant.value);
    return isNumericLiteral(constant.value) ? constant.value : quote(constant.value);
};

const isStringTyped = (context: ModuleContext, type: TypeId | undefined): boolean => {
    if (type === undefined) return false;
    const resolved = context.repository.typeOf(type);
    return resolved?.kind === "primitive" && resolved.category === "string";
};

const isNumericLiteral = (value: string): boolean => /^-?(?:\d+|\d*\.\d+)$/.test(value);
