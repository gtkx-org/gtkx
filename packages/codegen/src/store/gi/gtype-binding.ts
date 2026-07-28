import { sourceStringLiteral } from "@gtkx/utils";
import type { ModuleContext } from "../../writer/context.js";
import { PRIMITIVE_TS_TYPE } from "../../gir/primitives.js";

type TypeSource = {
    glibGetType: string | undefined;
    glibTypeName: string | undefined;
};

const gtypeTsType = (context: ModuleContext): string =>
    context.namespace.name === "GObject" ? "Type" : PRIMITIVE_TS_TYPE.gtype;

const gtypeMemberDeclaration = (context: ModuleContext): string => `declare __type__: ${gtypeTsType(context)};`;

const renderInternGtype = (context: ModuleContext, typeName: string | undefined): string | undefined => {
    if (typeName === undefined) {
        return undefined;
    }

    if (context.namespace.name !== "GObject") {
        context.addRuntimeImport("typeFromName");
    }

    return `typeFromName(${sourceStringLiteral(typeName)})`;
};

const renderResolveGtype = (context: ModuleContext, typeFnName: string): string => {
    context.addRuntimeImport("resolveType");
    const lib = context.namespace.sharedLibrary ?? "";

    return `resolveType(${sourceStringLiteral(lib)}, ${sourceStringLiteral(typeFnName)})`;
};

const renderGtypeExpression = (
    context: ModuleContext,
    typeFnName: string,
    typeName: string | undefined,
): string | undefined =>
    typeFnName === "intern" ? renderInternGtype(context, typeName) : renderResolveGtype(context, typeFnName);

const renderSourceGtype = (context: ModuleContext, source: TypeSource): string | undefined =>
    source.glibGetType === undefined
        ? undefined
        : renderGtypeExpression(context, source.glibGetType, source.glibTypeName);

export { gtypeTsType, gtypeMemberDeclaration, renderSourceGtype };
