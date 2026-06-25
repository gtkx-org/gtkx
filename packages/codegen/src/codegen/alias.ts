import type { GirAlias } from "../gir/namespace.js";
import type { ModuleContext } from "../writer/context.js";
import { aliasExportName } from "../writer/identifier.js";
import { renderTsType } from "./ts-type.js";

export const generateAlias = (context: ModuleContext, alias: GirAlias): void => {
    const exportName = aliasExportName(context.namespace.name, alias.name);
    const targetType = exportName === "GType" ? "bigint" : renderTsType(context, alias.target);
    context.module.appendDeclaration(`export type ${exportName} = ${targetType};`);
};
