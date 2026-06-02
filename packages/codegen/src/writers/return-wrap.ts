import type { ModuleContext } from "../dsl/context.js";
import type { ParameterTransfer } from "../gir/parameter.js";
import type { ResolvedNamed } from "../gir/repository.js";
import type { GirTypeRef, NamedTypeRef, PrimitiveTypeRef } from "../gir/type-ref.js";
import { renderTsType } from "./ts-type.js";

/**
 * Lifting raw FFI call results into their typed JavaScript form: objects to
 * their runtime-registered wrappers, boxed values to typed wrappers,
 * collections per element, and primitives with the appropriate coercion.
 * Shared by method-body return handling, signal/callback argument marshalling,
 * and boxed field accessors.
 */

/**
 * Casts a raw FFI call result to a native handle so the registry wrappers
 * (`getNativeObject` / `getNativeObjectAsInterface`) accept it. The cast widens
 * to `NativeHandle | null` for a GIR-nullable value so the wrapper result type
 * stays nullable, matching the declared return.
 */
export const handleCast = (context: ModuleContext, valueExpression: string, nullable: boolean): string => {
    context.addNativeTypeImport("NativeHandle");
    return `${valueExpression} as NativeHandle${nullable ? " | null" : ""}`;
};

/**
 * Inputs for {@link wrapReturnValue}.
 */
export type WrapReturnOptions = {
    readonly ref: GirTypeRef | undefined;
    readonly transfer: ParameterTransfer;
    readonly nullable: boolean;
    readonly valueExpression: string;
};

/**
 * Wraps a raw FFI value into its typed JavaScript form.
 *
 * Objects resolve to their runtime-registered wrapper, interfaces to the
 * interface wrapper, boxed values to a typed wrapper, collections recurse per
 * element, and primitives pass through with the appropriate coercion. Shared
 * by return-value handling and signal-handler argument marshalling.
 *
 * @param context - The module context
 * @param options - {@link WrapReturnOptions}
 */
export const wrapReturnValue = (context: ModuleContext, options: WrapReturnOptions): string => {
    const { ref, nullable, valueExpression } = options;
    if (ref === undefined) return valueExpression;
    switch (ref.kind) {
        case "primitive":
            return wrapPrimitive(ref, nullable, valueExpression);
        case "named":
            return wrapNamed(context, ref, valueExpression, nullable);
        case "array":
            return wrapCollection(context, ref.element, valueExpression, nullable);
        case "list":
            return ref.flavor === "gbytearray"
                ? `(${valueExpression} as number[]${nullable ? " | null" : ""})`
                : wrapCollection(context, ref.element, valueExpression, nullable);
        case "hashtable":
            return nullable
                ? `(${valueExpression} === null ? null : new globalThis.Map(${valueExpression} as Iterable<readonly [unknown, unknown]>))`
                : `new globalThis.Map(${valueExpression} as Iterable<readonly [unknown, unknown]>)`;
        case "callback":
        case "varargs":
            return `(${valueExpression} as unknown[])`;
    }
};

/**
 * Wraps a collection return value, mapping each element through the runtime
 * wrapper its type requires.
 *
 * The native layer hands collection returns back as arrays of raw element
 * values; object, interface, and boxed elements must be lifted into their
 * typed JavaScript wrappers (matching the per-element wrapping a scalar
 * return of the same type receives) while primitive and enum elements pass
 * through untouched.
 */
const wrapCollection = (
    context: ModuleContext,
    element: GirTypeRef | undefined,
    valueExpression: string,
    nullable: boolean,
): string => {
    const itemExpression = collectionItemWrap(context, element);
    if (itemExpression === undefined) {
        const elementTs = element === undefined ? "unknown" : renderTsType(context, element, false);
        return `(${valueExpression} as ${elementTs}[]${nullable ? " | null" : ""})`;
    }
    return nullable
        ? `((${valueExpression} as unknown[] | null)?.map((item) => ${itemExpression}) ?? null)`
        : `(${valueExpression} as unknown[]).map((item) => ${itemExpression})`;
};

const collectionItemWrap = (context: ModuleContext, element: GirTypeRef | undefined): string | undefined => {
    if (element === undefined || element.kind !== "named") return undefined;
    const owner = element.namespaceName ?? context.namespace.name;
    const resolved = context.repository.resolveNamed(owner, element.typeName);
    if (resolved === undefined) {
        context.addRuntimeImport("getNativeObject");
        return `getNativeObject(${handleCast(context, "item", false)})`;
    }
    switch (resolved.kind) {
        case "class":
        case "boxed":
            context.addRuntimeImport("getNativeObject");
            return `getNativeObject(${handleCast(context, "item", false)})`;
        case "interface": {
            context.addRuntimeImport("getNativeObjectAsInterface");
            return `getNativeObjectAsInterface(${handleCast(context, "item", false)}, ${context.qualify(owner, element.typeName)})`;
        }
        case "alias":
            return resolved.target === undefined
                ? undefined
                : collectionItemWrap(context, {
                      kind: "named",
                      namespaceName: resolved.namespace.name,
                      typeName: resolved.target,
                      cType: undefined,
                  });
        case "enum":
        case "callback":
            return undefined;
    }
};

const wrapPrimitive = (ref: PrimitiveTypeRef, nullable: boolean, valueExpression: string): string => {
    const category = ref.category;
    if (category === "void") return valueExpression;
    if (category === "string") return `(${valueExpression} as ${nullable ? "string | null" : "string"})`;
    if (category === "boolean") return `Boolean(${valueExpression})`;
    return `(${valueExpression} as number)`;
};

const wrapNamed = (context: ModuleContext, ref: NamedTypeRef, valueExpression: string, nullable: boolean): string => {
    const owner = ref.namespaceName ?? context.namespace.name;
    const resolved = context.repository.resolveNamed(owner, ref.typeName);
    if (resolved === undefined) {
        context.addRuntimeImport("getNativeObject");
        return `getNativeObject(${handleCast(context, valueExpression, nullable)})`;
    }
    return wrapResolved(context, resolved, { namespaceName: owner, typeName: ref.typeName, valueExpression, nullable });
};

type WrapResolvedOptions = {
    readonly namespaceName: string;
    readonly typeName: string;
    readonly valueExpression: string;
    readonly nullable: boolean;
};

const wrapResolved = (context: ModuleContext, resolved: ResolvedNamed, options: WrapResolvedOptions): string => {
    const { namespaceName, typeName, valueExpression, nullable } = options;
    switch (resolved.kind) {
        case "class": {
            context.addRuntimeImport("getNativeObject");
            return `getNativeObject(${handleCast(context, valueExpression, nullable)})`;
        }
        case "interface": {
            const classExpression = context.qualify(namespaceName, typeName);
            context.addRuntimeImport("getNativeObjectAsInterface");
            return `getNativeObjectAsInterface(${handleCast(context, valueExpression, nullable)}, ${classExpression})`;
        }
        case "boxed": {
            const classExpression = context.qualify(namespaceName, typeName);
            context.addRuntimeImport("getNativeObject");
            return `getNativeObject(${handleCast(context, valueExpression, nullable)}, ${classExpression})`;
        }
        case "enum":
            return `(${valueExpression} as number)`;
        case "callback":
            return valueExpression;
        case "alias":
            return resolved.targetRef === undefined
                ? valueExpression
                : wrapReturnValue(context, { ref: resolved.targetRef, transfer: "full", nullable, valueExpression });
    }
};
