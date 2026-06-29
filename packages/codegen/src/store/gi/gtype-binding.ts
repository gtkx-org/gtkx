import { sourceStringLiteral } from "@gtkx/utils";
import { tBigUint64, tBind, tString } from "../../analysis/descriptor.js";
import type { ModuleContext } from "../../writer/context.js";
import { bindingIdentifier } from "../../writer/identifier.js";

const TYPE_FROM_NAME_SYMBOL = "g_type_from_name";
const TYPE_FROM_NAME_LIB = "libgobject-2.0.so.0";

export const gtypeTsType = (context: ModuleContext): string =>
    context.namespace.name === "GObject" ? "Type" : "bigint";

export const gtypeMemberDeclaration = (context: ModuleContext): string => `declare __gtype__: ${gtypeTsType(context)};`;

const renderGtypeExpression = (
    context: ModuleContext,
    getType: string,
    typeName: string | undefined,
): string | undefined => {
    if (getType === "intern") {
        if (typeName === undefined) return undefined;
        appendGtypeFromNameBinding(context);
        return `${bindingIdentifier(TYPE_FROM_NAME_SYMBOL)}(${sourceStringLiteral(typeName)}) as bigint`;
    }
    appendGetTypeBinding(context, getType);
    return `${bindingIdentifier(getType)}() as bigint`;
};

type GTypeSource = {
    glibGetType: string | undefined;
    glibTypeName: string | undefined;
};

export const gtypeExprFor = (context: ModuleContext, source: GTypeSource): string | undefined =>
    source.glibGetType === undefined
        ? undefined
        : renderGtypeExpression(context, source.glibGetType, source.glibTypeName);

const appendGetTypeBinding = (context: ModuleContext, getType: string): void => {
    const lib = context.namespace.sharedLibrary ?? "";
    const expression = tBind({
        libExpr: sourceStringLiteral(lib),
        symbolExpr: sourceStringLiteral(getType),
        argList: "[]",
        returnType: tBigUint64,
    });
    context.module.appendBinding(`const ${bindingIdentifier(getType)} = ${expression};`, getType);
};

const appendGtypeFromNameBinding = (context: ModuleContext): void => {
    const expression = tBind({
        libExpr: sourceStringLiteral(TYPE_FROM_NAME_LIB),
        symbolExpr: sourceStringLiteral(TYPE_FROM_NAME_SYMBOL),
        argList: `[${tString("borrowed")}]`,
        returnType: tBigUint64,
    });
    context.module.appendBinding(
        `const ${bindingIdentifier(TYPE_FROM_NAME_SYMBOL)} = ${expression};`,
        TYPE_FROM_NAME_SYMBOL,
    );
};
