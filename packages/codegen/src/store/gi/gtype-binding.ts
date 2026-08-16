import { sourceStringLiteral } from "@gtkx/utils";
import type { ModuleContext } from "../../writer/context.js";
import { PRIMITIVE_TS_TYPE } from "../../gir/primitives.js";
import { renderJsDoc } from "../../writer/doc.js";
import { renderBlock } from "../../writer/emit.js";

type TypeSource = {
    glibGetType: string | undefined;
    glibTypeName: string | undefined;
};

const GTYPE_NOTE = [
    "The GType this class is registered under, read off the class it is accessed on rather than",
    "inherited, so a subclass `registerClass` created reports its own type and one that never went",
    "through `registerClass` reports the invalid type.",
].join("\n");

const gtypeTsType = (context: ModuleContext): string =>
    context.namespace.name === "GObject" ? "Type" : PRIMITIVE_TS_TYPE.gtype;

const gtypeMemberDeclaration = (context: ModuleContext): string => `declare __type__: ${gtypeTsType(context)};`;

const gtypeStaticMember = (context: ModuleContext): string => {
    context.addRuntimeImport("getClassType");
    const block = renderBlock(`static get __gtype__(): ${gtypeTsType(context)}`, "return getClassType(this);");

    return `${renderJsDoc(undefined, GTYPE_NOTE)}${block}`;
};

const renderInternGtype = (context: ModuleContext, typeName: string | undefined): string | undefined => {
    if (typeName === undefined) {
        return undefined;
    }

    if (context.namespace.name !== "GObject") {
        context.addRuntimeImport("typeFromName");
    }

    return `typeFromName(${sourceStringLiteral(typeName)})`;
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
): string | undefined =>
    typeFnName === "intern" ? renderInternGtype(context, typeName) : renderResolveGtype(context, typeFnName);

const renderSourceGtype = (context: ModuleContext, source: TypeSource): string | undefined =>
    source.glibGetType === undefined
        ? undefined
        : renderGtypeExpression(context, source.glibGetType, source.glibTypeName);

export { gtypeTsType, gtypeMemberDeclaration, gtypeStaticMember, renderSourceGtype };
