import { renderTsType } from "../../analysis/ts-type.js";
import type { GirAlias } from "../../gir/namespace.js";
import { PRIMITIVE_TS_TYPE, primitiveCategory } from "../../gir/primitives.js";
import type { ModuleContext } from "../../writer/context.js";

export const generateAlias = (context: ModuleContext, alias: GirAlias): void => {
    const category = alias.cType === undefined ? undefined : primitiveCategory(alias.cType);
    const targetType = category === "gtype" ? PRIMITIVE_TS_TYPE.gtype : renderTsType(context, alias.target);
    context.module.appendDeclaration(`export type ${alias.name} = ${targetType};`);
};
