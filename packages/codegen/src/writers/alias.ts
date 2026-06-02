import { toPascalCase } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import type { GirAlias } from "../gir/namespace.js";
import { writeTsType } from "./ts-type.js";

/**
 * Emits an `export type` declaration for a GIR `<alias>`.
 *
 * The alias is exported under its GIR `c:type` when present (the C-side name
 * runtime consumers reach for, e.g. `GType` rather than `Type`), falling back
 * to the PascalCase form of its `name`.
 *
 * @param ctx - The module context
 * @param alias - The alias to emit
 */
export const emitAlias = (ctx: ModuleContext, alias: GirAlias): void => {
    const exportName = alias.cType ?? toPascalCase(alias.name);
    const targetType = writeTsType(ctx, alias.target);
    ctx.module.appendDeclaration(`export type ${exportName} = ${targetType};`);
};
