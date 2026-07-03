import { sourceStringLiteral } from "@gtkx/utils";
import { PRIMITIVE_TS_TYPE } from "../../gir/primitives.js";
import type { ModuleContext } from "../../writer/context.js";

export const gtypeTsType = (context: ModuleContext): string =>
    context.namespace.name === "GObject" ? "Type" : PRIMITIVE_TS_TYPE.gtype;

export const gtypeMemberDeclaration = (context: ModuleContext): string => `declare __type__: ${gtypeTsType(context)};`;

const renderGtypeExpression = (
    context: ModuleContext,
    getType: string,
    typeName: string | undefined,
): string | undefined => {
    if (getType === "intern") {
        if (typeName === undefined) return undefined;
        if (context.namespace.name !== "GObject") context.addRuntimeImport("typeFromName");
        return `typeFromName(${sourceStringLiteral(typeName)})`;
    }
    context.addRuntimeImport("resolveType");
    const lib = context.namespace.sharedLibrary ?? "";
    return `resolveType(${sourceStringLiteral(lib)}, ${sourceStringLiteral(getType)})`;
};

type GTypeSource = {
    glibGetType: string | undefined;
    glibTypeName: string | undefined;
};

export const gtypeExprFor = (context: ModuleContext, source: GTypeSource): string | undefined =>
    source.glibGetType === undefined
        ? undefined
        : renderGtypeExpression(context, source.glibGetType, source.glibTypeName);
