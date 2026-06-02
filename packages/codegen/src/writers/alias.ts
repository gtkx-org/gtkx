import type { ModuleContext } from "../dsl/context.js";
import { aliasExportName } from "../dsl/identifier.js";
import type { GirAlias } from "../gir/namespace.js";
import { renderTsType } from "./ts-type.js";

/**
 * Emits an `export type` declaration for a GIR `<alias>`.
 *
 * The alias is exported under {@link aliasExportName} — its GIR `name`, with
 * GObject's `Type` published as `GType`.
 *
 * @param ctx - The module context
 * @param alias - The alias to emit
 */
export const emitAlias = (ctx: ModuleContext, alias: GirAlias): void => {
    const exportName = aliasExportName(ctx.namespace.name, alias.name);
    const targetType = renderTsType(ctx, alias.target);
    ctx.module.appendDeclaration(`export type ${exportName} = ${targetType};`);
};
