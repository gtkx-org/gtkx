import type { ModuleContext } from "../dsl/context.js";
import type { PrimitiveCategory } from "../gir/primitives.js";
import type { TypeId } from "../gir/type-id.js";
import { renderFfiType } from "./value.js";

/**
 * Lifting raw FFI values into their typed JavaScript form for the per-call
 * sites — signal/callback handler arguments and boxed field getters.
 *
 * Object, interface, boxed, collection, and hash-table values route through the
 * runtime {@link wrapValue}, driven by an FFI descriptor this hoists to a
 * module-level const (built once, so the wrap allocates nothing per call). That
 * keeps the registry resolution (`wrapHandle` and the identity cache it consults)
 * internal to `@gtkx/ffi`. Primitives, enums, and callbacks coerce inline,
 * leaving the hot scalar path free of an extra call. The method-return path
 * wraps inside `t.fn` instead, via its return descriptor.
 */

/**
 * Inputs for {@link wrapReturnValue}.
 */
export type WrapReturnOptions = {
    readonly ref: TypeId | undefined;
    readonly nullable: boolean;
    readonly valueExpression: string;
};

/**
 * Wraps a raw FFI value into its typed JavaScript form.
 *
 * Primitives, enums, and callbacks coerce inline; everything that needs a
 * registry wrapper (objects, interfaces, boxed records, collections, hash
 * tables) routes through {@link wrapValue} with a hoisted FFI descriptor and,
 * where the descriptor lacks the identity, a pre-resolved wrapper class.
 *
 * @param context - The module context
 * @param options - {@link WrapReturnOptions}
 */
export const wrapReturnValue = (context: ModuleContext, options: WrapReturnOptions): string => {
    const { ref, nullable, valueExpression } = options;
    if (ref === undefined) return valueExpression;
    const type = context.repository.typeOf(ref);
    if (type === undefined) return wrapViaFfiValue(context, ref, valueExpression);
    switch (type.kind) {
        case "primitive":
            return wrapPrimitive(type.category, nullable, valueExpression);
        case "varargs":
            return `(${valueExpression} as unknown[])`;
        case "callback":
            return context.repository.nameOf(ref) === undefined ? `(${valueExpression} as unknown[])` : valueExpression;
        case "enum":
            return `(${valueExpression} as number)`;
        case "alias":
            return type.target === undefined
                ? valueExpression
                : wrapReturnValue(context, { ref: type.target, nullable, valueExpression });
        default:
            return wrapViaFfiValue(context, ref, valueExpression);
    }
};

/**
 * Routes a value through the runtime {@link wrapValue}, hoisting its FFI
 * descriptor to a module-level const so the wrap allocates nothing per call.
 * Ownership is irrelevant to wrapping, so the descriptor is rendered borrowed;
 * the descriptor itself carries the fallback wrapper class for an identity-less
 * value, so none is threaded here.
 */
const wrapViaFfiValue = (context: ModuleContext, ref: TypeId, valueExpression: string): string => {
    context.addRuntimeImport("wrapValue");
    const descriptor = context.hoistFfiType(renderFfiType(context, ref, "none"));
    return `wrapValue(${descriptor}, ${valueExpression})`;
};

const wrapPrimitive = (category: PrimitiveCategory, nullable: boolean, valueExpression: string): string => {
    if (category === "void") return valueExpression;
    if (category === "string") return `(${valueExpression} as ${nullable ? "string | null" : "string"})`;
    if (category === "boolean") return `Boolean(${valueExpression})`;
    if (category === "gtype" || category === "bigint64" || category === "biguint64") {
        return `(${valueExpression} as bigint)`;
    }
    return `(${valueExpression} as number)`;
};
