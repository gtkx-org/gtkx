import { quote } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import { bindingIdentifier } from "../dsl/identifier.js";

const TYPE_FROM_NAME_SYMBOL = "g_type_from_name";
const TYPE_FROM_NAME_LIB = "libgobject-2.0.so.0";

/**
 * Renders the JS expression that resolves a type's runtime `GType`, appending
 * any required `t.bind` bindings to the module.
 *
 * For regular get-type symbols (`g_object_get_type`, `g_array_get_type`, …) the
 * helper appends a `t.bind(...)` binding for the symbol and returns
 * `Number(g_object_get_type())`. For the GIR sentinel `"intern"` — used on
 * `GVariant` and a few other types whose `GType` is registered intrinsically —
 * it appends a binding for `g_type_from_name` and returns
 * `Number(g_type_from_name("…"))`. Returns `undefined` when neither path is
 * available.
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
    if (getType === "intern" || getType === "") {
        if (glibTypeName === undefined) return undefined;
        appendGtypeFromNameBinding(context);
        return `Number(${bindingIdentifier(TYPE_FROM_NAME_SYMBOL)}(${quote(glibTypeName)}))`;
    }
    appendGetTypeBinding(context, getType);
    return `Number(${bindingIdentifier(getType)}())`;
};

const appendGetTypeBinding = (context: ModuleContext, getType: string): void => {
    const lib = context.namespace.sharedLibrary ?? "";
    const expression = `t.bind(${quote(lib)}, ${quote(getType)}, [], t.uint64)`;
    context.module.appendBinding(`const ${bindingIdentifier(getType)} = ${expression};`, getType);
};

const appendGtypeFromNameBinding = (context: ModuleContext): void => {
    const expression = `t.bind(${quote(TYPE_FROM_NAME_LIB)}, ${quote(TYPE_FROM_NAME_SYMBOL)}, [t.string("borrowed")], t.uint64)`;
    context.module.appendBinding(
        `const ${bindingIdentifier(TYPE_FROM_NAME_SYMBOL)} = ${expression};`,
        TYPE_FROM_NAME_SYMBOL,
    );
};
