import type { ModuleContext } from "../dsl/context.js";
import { quote } from "../dsl/emit.js";
import type { GirConstant } from "../gir/namespace.js";

/**
 * Emits an `export const NAME = value` declaration for a namespace
 * constant.
 *
 * Numeric values are emitted as bare numerals; everything else is
 * emitted as a quoted string. This matches the existing FFI output where
 * every constant is typed as `number` in the `.d.ts`.
 *
 * @param ctx - The module context
 * @param constant - The constant
 */
export const emitConstant = (ctx: ModuleContext, constant: GirConstant): void => {
    const literal = isNumericLiteral(constant.value) ? constant.value : quote(constant.value);
    ctx.module.appendDeclaration(`export const ${constant.name} = ${literal};`);
};

const isNumericLiteral = (value: string): boolean => /^-?(?:\d+|\d*\.\d+)$/.test(value);
