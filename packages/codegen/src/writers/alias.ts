import { bigintAliasCategory } from "../bigint-aliases.js";
import type { ModuleContext } from "../dsl/context.js";
import { aliasExportName } from "../dsl/identifier.js";
import type { GirAlias } from "../gir/namespace.js";
import { renderTsType } from "./ts-type.js";

/**
 * Emits an `export type` declaration for a GIR `<alias>`.
 *
 * The alias is exported under {@link aliasExportName} — its GIR `name`, with
 * GObject's `Type` published as `GType`. An alias listed in the project's
 * merged `bigintAliases` set is declared as `bigint` instead of its target's
 * surface type, pairing with the `t.bigint64`/`t.biguint64` FFI descriptors
 * its use sites emit.
 *
 * @param context - The module context
 * @param alias - The alias to emit
 */
export const emitAlias = (context: ModuleContext, alias: GirAlias): void => {
    const exportName = aliasExportName(context.namespace.name, alias.name);
    const qualifiedName = `${context.namespace.name}.${alias.name}`;
    if (context.bigintAliases.has(qualifiedName)) {
        bigintAliasCategory(qualifiedName, alias.target);
        context.module.appendDeclaration(`export type ${exportName} = bigint;`);
        return;
    }
    const targetType = renderTsType(context, alias.target);
    context.module.appendDeclaration(`export type ${exportName} = ${targetType};`);
};
