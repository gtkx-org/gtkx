import { renderTsType } from "../../analysis/ts-type.js";
import type { GirAlias } from "../../gir/namespace.js";
import type { ModuleContext } from "../../writer/context.js";

export const generateAlias = (context: ModuleContext, alias: GirAlias): void => {
    const isGObjectType = context.namespace.name === "GObject" && alias.name === "Type";
    const targetType = isGObjectType ? "bigint" : renderTsType(context, alias.target);
    context.module.appendDeclaration(`export type ${alias.name} = ${targetType};`);
};
