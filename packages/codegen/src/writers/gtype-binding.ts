import { quote } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import { bindingIdentifier } from "../dsl/identifier.js";

const TYPE_FROM_NAME_SYMBOL = "g_type_from_name";
const TYPE_FROM_NAME_LIB = "libgobject-2.0.so.0";

/**
 * Resolves the `GType` alias name to reference in `context`'s module, adding the
 * import it needs.
 *
 * The `GObject` namespace publishes the canonical `GType` alias from its GIR
 * `Type` alias, so its own modules use the bare local name. Every other module
 * imports the same alias type-only from `@gtkx/ffi`, which all generated
 * modules already import for the `t` runtime. Routing the alias through
 * `@gtkx/ffi` rather than `GObject` keeps foundational modules such as `GLib`
 * — which carry `__gtype__` members but must not import `GObject` — free of a
 * cross-namespace edge.
 *
 * @param context - The module context
 */
export const gtypeTsType = (context: ModuleContext): string => {
    if (context.namespace.name !== "GObject") context.addRuntimeTypeImport("GType");
    return "GType";
};

/**
 * Renders the `declare __gtype__: GType;` member every generated wrapper class,
 * interface, and boxed record carries, resolving the alias via
 * {@link gtypeTsType}.
 *
 * @param context - The module context
 */
export const gtypeMemberDeclaration = (context: ModuleContext): string => `declare __gtype__: ${gtypeTsType(context)};`;

/**
 * Renders the JS expression that resolves a type's runtime `GType`, appending
 * any required `t.bind` bindings to the module.
 *
 * For regular get-type symbols (`g_object_get_type`, `g_array_get_type`, …) the
 * helper appends a `t.bind(...)` binding for the symbol and returns
 * `g_object_get_type() as bigint`. For the GIR sentinel `"intern"` — used on
 * `GVariant` and a few other types whose `GType` is registered intrinsically —
 * it appends a binding for `g_type_from_name` and returns
 * `g_type_from_name("…") as bigint`. The `t.biguint64` binding already yields a
 * `bigint` at runtime, so the cast only narrows the bind's `unknown` return.
 * Returns `undefined` when neither path is available.
 *
 * @param context - The module context
 * @param getType - The C symbol name or the GIR sentinel `"intern"`
 * @param glibTypeName - The GLib type name (for `"intern"` get-types)
 */
export const renderGtypeExpression = (
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

const appendGetTypeBinding = (context: ModuleContext, getType: string): void => {
    const lib = context.namespace.sharedLibrary ?? "";
    const expression = `t.bind(${quote(lib)}, ${quote(getType)}, [], t.biguint64)`;
    context.module.appendBinding(`const ${bindingIdentifier(getType)} = ${expression};`, getType);
};

const appendGtypeFromNameBinding = (context: ModuleContext): void => {
    const expression = `t.bind(${quote(TYPE_FROM_NAME_LIB)}, ${quote(TYPE_FROM_NAME_SYMBOL)}, [t.string("borrowed")], t.biguint64)`;
    context.module.appendBinding(
        `const ${bindingIdentifier(TYPE_FROM_NAME_SYMBOL)} = ${expression};`,
        TYPE_FROM_NAME_SYMBOL,
    );
};
