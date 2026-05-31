import { quote } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";

const TYPE_FROM_NAME_BINDING = "g_type_from_name";
const TYPE_FROM_NAME_LIB = "libgobject-2.0.so.0";

/**
 * Renders the JS expression that resolves a class's `GType`, appending any
 * required `t.fn` bindings to the module.
 *
 * For regular get-type symbols (`g_object_get_type`, `g_array_get_type`, …)
 * the helper appends a `t.fn(...)` binding for the symbol and returns the bare
 * function reference (`g_object_get_type`), which the runtime invokes once. For
 * the GIR sentinel `"intern"` — used on `GVariant` and a few other types whose
 * `GType` is registered intrinsically — it appends a binding for
 * `g_type_from_name` and returns a `() => g_type_from_name("…")` thunk. Returns
 * `undefined` when neither path is available.
 *
 * @param ctx - The module context
 * @param getType - The C symbol name or the GIR sentinel `"intern"`
 * @param glibTypeName - The GLib type name (for `"intern"` get-types)
 */
export const renderGetTypeReference = (
    ctx: ModuleContext,
    getType: string,
    glibTypeName: string | undefined,
): string | undefined => {
    if (getType === "intern" || getType === "") {
        if (glibTypeName === undefined) return undefined;
        appendGTypeFromNameBinding(ctx);
        return `() => ${TYPE_FROM_NAME_BINDING}(${quote(glibTypeName)})`;
    }
    appendGetTypeBinding(ctx, getType);
    return getType;
};

const appendGetTypeBinding = (ctx: ModuleContext, getType: string): void => {
    const lib = ctx.namespace.sharedLibrary ?? "";
    const expression = `t.fn(${quote(lib)}, ${quote(getType)}, [], t.uint64)`;
    ctx.module.appendBinding(`const ${getType} = ${expression};`, getType);
};

const appendGTypeFromNameBinding = (ctx: ModuleContext): void => {
    const expression =
        `t.fn(${quote(TYPE_FROM_NAME_LIB)}, ${quote(TYPE_FROM_NAME_BINDING)}, ` +
        `[{ type: t.string("borrowed") }], t.uint64)`;
    ctx.module.appendBinding(`const ${TYPE_FROM_NAME_BINDING} = ${expression};`, TYPE_FROM_NAME_BINDING);
};
