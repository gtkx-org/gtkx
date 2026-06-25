import { renderTsType } from "../analysis/ts-type.js";
import type { GirAlias } from "../gir/namespace.js";
import type { ModuleContext } from "../writer/context.js";
import { aliasExportName } from "../writer/identifier.js";

export const generateAlias = (context: ModuleContext, alias: GirAlias): void => {
    const exportName = aliasExportName(context.namespace.name, alias.name);
    const targetType = exportName === "GType" ? "bigint" : renderTsType(context, alias.target);
    context.module.appendDeclaration(`export type ${exportName} = ${targetType};`);
};
