import type { ModuleContext } from "../dsl/context.js";
import type { GirTypeRef, NamedTypeRef, PrimitiveTypeRef } from "../gir/type-ref.js";
import { boxedNeedsFallbackClass, renderFfiType } from "./value.js";

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
 * Ownership is irrelevant to wrapping, so the descriptor is rendered borrowed.
 */
const wrapViaFfiValue = (context: ModuleContext, ref: GirTypeRef, valueExpression: string): string => {
    context.addRuntimeImport("wrapValue");
    const descriptor = context.hoistFfiType(renderFfiType(context, ref, "none"));
    const wrapperClass = resolveWrapperClass(context, ref);
    return wrapperClass === undefined
        ? `wrapValue(${descriptor}, ${valueExpression})`
        : `wrapValue(${descriptor}, ${valueExpression}, ${wrapperClass})`;
};

const wrapPrimitive = (ref: PrimitiveTypeRef, nullable: boolean, valueExpression: string): string => {
    const category = ref.category;
    if (category === "void") return valueExpression;
    if (category === "string") return `(${valueExpression} as ${nullable ? "string | null" : "string"})`;
    if (category === "boolean") return `Boolean(${valueExpression})`;
    return `(${valueExpression} as number)`;
};

/**
 * Resolves the fallback wrapper class {@link wrapValue} needs to lift a value of
 * `ref`, or `undefined` when the value's FFI descriptor carries enough `GType`
 * identity to recover its class on its own.
 *
 * Almost every kind self-resolves: an object off its runtime GLib type (its
 * descriptor names an interface when one is needed), a boxed record or named
 * fundamental through the `GType` its descriptor identifies, and primitives,
 * enums, and hash tables need no class at all. Only the kinds whose descriptor
 * carries no recoverable identity supply a fallback — a plain `struct` and a
 * GType-less fundamental such as `GAsyncQueue`. A collection resolves its
 * element's fallback, applied per element. Used both for the `t.fn` return
 * descriptor and the per-call `wrapValue` sites.
 *
 * @param context - The module context
 * @param ref - The value's GIR type reference
 * @returns The qualified fallback-class expression, or `undefined`
 */
export const resolveWrapperClass = (context: ModuleContext, ref: GirTypeRef | undefined): string | undefined => {
    if (ref === undefined) return undefined;
    switch (ref.kind) {
        case "primitive":
        case "hashtable":
        case "callback":
        case "varargs":
            return undefined;
        case "named":
            return namedWrapperClass(context, ref);
        case "array":
            return resolveWrapperClass(context, ref.element);
        case "list":
            return ref.flavor === "gbytearray" ? undefined : resolveWrapperClass(context, ref.element);
    }
};

const namedWrapperClass = (context: ModuleContext, ref: NamedTypeRef): string | undefined => {
    const owner = ref.namespaceName ?? context.namespace.name;
    const resolved = context.repository.resolveNamed(owner, ref.typeName);
    if (resolved === undefined) return undefined;
    switch (resolved.kind) {
        case "boxed":
            return boxedNeedsFallbackClass(resolved.value) ? context.qualify(owner, ref.typeName) : undefined;
        case "alias":
            return resolveWrapperClass(context, resolved.targetRef);
        case "interface":
        case "class":
        case "enum":
        case "callback":
            return undefined;
    }
};
