import type { ModuleContext } from "../dsl/context.js";
import { aliasExportName } from "../dsl/identifier.js";
import type { GirAlias } from "../gir/namespace.js";
import { renderTsType } from "./ts-type.js";

export const emitAlias = (context: ModuleContext, alias: GirAlias): void => {
    const exportName = aliasExportName(context.namespace.name, alias.name);
    const targetType = exportName === "GType" ? "bigint" : renderTsType(context, alias.target);
    context.module.appendDeclaration(`export type ${exportName} = ${targetType};`);
};
