import { sourceStringLiteral } from "@gtkx/utils";
import type { ModuleContext } from "../../writer/context.js";
import { PRIMITIVE_TS_TYPE } from "../../gir/primitives.js";

type TypeSource = {
    glibGetType: string | undefined;
    glibTypeName: string | undefined;
};

const gtypeTsType = (context: ModuleContext): string =>
    context.namespace.name === "GObject" ? "Type" : PRIMITIVE_TS_TYPE.gtype;

const gtypeParamTsType = (context: ModuleContext): string => {
    context.addRuntimeTypeImport("AnyClass");
    context.addRuntimeTypeImport("TypedClass");

    return `${gtypeTsType(context)} | AnyClass<TypedClass>`;
};

const gtypeMemberDeclaration = (context: ModuleContext): string => `declare __type__: ${gtypeTsType(context)};`;

const renderInternGtype = (context: ModuleContext, typeName: string | undefined): string | undefined => {
    if (typeName === undefined) {
        return undefined;
    }

    if (context.namespace.name !== "GObject") {
        context.addRuntimeImport("typeFromName");

        return `typeFromName(${sourceStringLiteral(typeName)})`;
    }

    context.module.imports.addNamed("@gtkx/runtime", "typeFromName", false, "runtimeTypeFromName");

    return `runtimeTypeFromName(${sourceStringLiteral(typeName)})`;
};

const renderResolveGtype = (context: ModuleContext, typeFnName: string): string | undefined => {
    const lib = context.namespace.sharedLibrary;

    if (lib === undefined) {
        return undefined;
    }

    context.addRuntimeImport("resolveType");

    return `resolveType(${sourceStringLiteral(lib)}, ${sourceStringLiteral(typeFnName)})`;
};

const renderGtypeExpression = (
    context: ModuleContext,
    typeFnName: string,
    typeName: string | undefined,
): string | undefined => {
    if (typeFnName === "intern") {
        return renderInternGtype(context, typeName);
    }

    return renderResolveGtype(context, typeFnName);
};

const renderSourceGtype = (context: ModuleContext, source: TypeSource): string | undefined =>
    source.glibGetType === undefined
        ? undefined
        : renderGtypeExpression(context, source.glibGetType, source.glibTypeName);

export { gtypeTsType, gtypeParamTsType, gtypeMemberDeclaration, renderSourceGtype };
