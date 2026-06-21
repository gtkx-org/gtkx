import { quote } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import { bindingIdentifier } from "../dsl/identifier.js";
import { tBigUint64, tBind, tString } from "./descriptor.js";

const TYPE_FROM_NAME_SYMBOL = "g_type_from_name";
const TYPE_FROM_NAME_LIB = "libgobject-2.0.so.0";

export const gtypeTsType = (context: ModuleContext): string => {
    if (context.namespace.name !== "GObject") context.addRuntimeTypeImport("GType");
    return "GType";
};

export const gtypeMemberDeclaration = (context: ModuleContext): string => `declare __gtype__: ${gtypeTsType(context)};`;

const renderGtypeExpression = (
    context: ModuleContext,
    getType: string,
    glibTypeName: string | undefined,
): string | undefined => {
    if (getType === "intern") {
        if (glibTypeName === undefined) return undefined;
        appendGtypeFromNameBinding(context);
        return `${bindingIdentifier(TYPE_FROM_NAME_SYMBOL)}(${quote(glibTypeName)}) as bigint`;
    }
    appendGetTypeBinding(context, getType);
    return `${bindingIdentifier(getType)}() as bigint`;
};

type GtypeSource = {
    glibGetType: string | undefined;
    glibTypeName: string | undefined;
};

export const gtypeExprFor = (context: ModuleContext, source: GtypeSource): string | undefined =>
    source.glibGetType === undefined
        ? undefined
        : renderGtypeExpression(context, source.glibGetType, source.glibTypeName);

const appendGetTypeBinding = (context: ModuleContext, getType: string): void => {
    const lib = context.namespace.sharedLibrary ?? "";
    const expression = tBind({
        libExpr: quote(lib),
        symbolExpr: quote(getType),
        argList: "[]",
        returnType: tBigUint64,
    });
    context.module.appendBinding(`const ${bindingIdentifier(getType)} = ${expression};`, getType);
};

const appendGtypeFromNameBinding = (context: ModuleContext): void => {
    const expression = tBind({
        libExpr: quote(TYPE_FROM_NAME_LIB),
        symbolExpr: quote(TYPE_FROM_NAME_SYMBOL),
        argList: `[${tString("borrowed")}]`,
        returnType: tBigUint64,
    });
    context.module.appendBinding(
        `const ${bindingIdentifier(TYPE_FROM_NAME_SYMBOL)} = ${expression};`,
        TYPE_FROM_NAME_SYMBOL,
    );
};
