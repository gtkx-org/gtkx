import { quote } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import type { GirConstant } from "../gir/namespace.js";
import type { GirTypeRef } from "../gir/type-ref.js";

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
    context.module.appendDeclaration(`export const ${constant.name} = ${constantLiteral(constant)};`);
};

const constantLiteral = (constant: GirConstant): string => {
    if (isStringTyped(constant.type)) return quote(constant.value);
    return isNumericLiteral(constant.value) ? constant.value : quote(constant.value);
};

const isStringTyped = (type: GirTypeRef | undefined): boolean =>
    type?.kind === "primitive" && type.category === "string";

const isNumericLiteral = (value: string): boolean => /^-?(?:\d+|\d*\.\d+)$/.test(value);
