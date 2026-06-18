import type { ModuleContext } from "../dsl/context.js";
import type { GirTypeRef, NamedTypeRef, PrimitiveTypeRef } from "../gir/type-ref.js";
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
    readonly ref: GirTypeRef | undefined;
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
    if (ref.kind === "primitive") return wrapPrimitive(ref, nullable, valueExpression);
    if (ref.kind === "callback" || ref.kind === "varargs") return `(${valueExpression} as unknown[])`;
    if (ref.kind === "named") {
        const inline = wrapNamedInline(context, ref, nullable, valueExpression);
        if (inline !== undefined) return inline;
    }
    return wrapViaFfiValue(context, ref, valueExpression);
};

/**
 * The inline wrap for a named type needing no registry wrapper — an enum (a
 * number), a callback (passthrough), or an alias resolving to one — or
 * `undefined` for a class/interface/boxed type, which routes through
 * {@link wrapViaFfiValue} instead.
 */
const wrapNamedInline = (
    context: ModuleContext,
    ref: NamedTypeRef,
    nullable: boolean,
    valueExpression: string,
): string | undefined => {
    const owner = ref.namespaceName ?? context.namespace.name;
    const resolved = context.repository.resolveNamed(owner, ref.typeName);
    if (resolved === undefined) return undefined;
    if (resolved.kind === "enum") return `(${valueExpression} as number)`;
    if (resolved.kind === "callback") return valueExpression;
    if (resolved.kind === "alias") {
        return resolved.targetRef === undefined
            ? valueExpression
            : wrapReturnValue(context, { ref: resolved.targetRef, nullable, valueExpression });
    }
    return undefined;
};

/**
 * Routes a value through the runtime {@link wrapValue}, hoisting its FFI
 * descriptor to a module-level const so the wrap allocates nothing per call.
 * Ownership is irrelevant to wrapping, so the descriptor is rendered borrowed;
 * the descriptor itself carries the fallback wrapper class for an identity-less
 * value, so none is threaded here.
 */
const wrapViaFfiValue = (context: ModuleContext, ref: GirTypeRef, valueExpression: string): string => {
    context.addRuntimeImport("wrapValue");
    const descriptor = context.hoistFfiType(renderFfiType(context, ref, "none"));
    return `wrapValue(${descriptor}, ${valueExpression})`;
};

const wrapPrimitive = (ref: PrimitiveTypeRef, nullable: boolean, valueExpression: string): string => {
    const category = ref.category;
    if (category === "void") return valueExpression;
    if (category === "string") return `(${valueExpression} as ${nullable ? "string | null" : "string"})`;
    if (category === "boolean") return `Boolean(${valueExpression})`;
    return `(${valueExpression} as number)`;
};
