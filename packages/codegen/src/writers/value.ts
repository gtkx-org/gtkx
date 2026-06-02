import { quote } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import { joinArgs } from "../dsl/emit.js";
import { callbackFromNode, type GirCallback } from "../gir/callback.js";
import type { GirNamespace } from "../gir/namespace.js";
import { type GirParameter, isInoutParameter, isOutParameter, type ParameterTransfer } from "../gir/parameter.js";
import { qualifyTypeRef } from "../gir/qualify.js";
import type { GirRepository, ResolvedNamed } from "../gir/repository.js";
import type { ArrayTypeRef, GirTypeRef, NamedTypeRef } from "../gir/type-ref.js";
import { computeBoxedFieldSlots } from "./boxed-layout.js";

/**
 * Inline byte sizes for boxed value types whose GIR record is opaque, so the
 * field layout cannot be computed but the type is still passed by value in
 * arrays (e.g. the `GValue` cells `g_signal_emitv` consumes).
 */
const HARDCODED_INLINE_ELEMENT_SIZES: ReadonlyMap<string, number> = new Map([["GObject.Value", 24]]);

/**
 * Maps a GIR transfer-ownership value to the FFI runtime's ownership
 * vocabulary.
 *
 * The runtime treats `"none"` as `"borrowed"` for incoming values and as
 * `"full"` for return values that already own the pointer. Callers pass
 * the GIR string directly; this helper does the translation.
 *
 * @param transfer - GIR transfer-ownership (`"none"`, `"full"`, `"container"`)
 */
const ffiOwnership = (transfer: ParameterTransfer): "borrowed" | "full" | "none" => {
    if (transfer === "full") return "full";
    if (transfer === "container") return "full";
    return "borrowed";
};

/**
 * Derives the transfer of a container's elements from the container's own
 * transfer. A `"container"` transfer owns the container but borrows its
 * elements, so they marshal as `"none"`; otherwise elements inherit the
 * container's transfer.
 *
 * @param transfer - The container's GIR transfer-ownership
 */
const deriveElementTransfer = (transfer: ParameterTransfer): ParameterTransfer =>
    transfer === "container" ? "none" : transfer;

/**
 * Renders a TypeScript expression that materialises the FFI type
 * descriptor for `ref`.
 *
 * @param context - The module context (used for cross-namespace imports)
 * @param ref - The GIR type reference, or `undefined` for void
 * @param transfer - GIR transfer-ownership conveyed onto the descriptor
 * @param argIndexOffset - Shift applied to a sized array's length-parameter
 *     index so it addresses the FFI argument list (which includes the
 *     instance receiver) rather than the GIR parameter list
 */
export const renderFfiType = (
    context: ModuleContext,
    ref: GirTypeRef | undefined,
    transfer: ParameterTransfer = "none",
    argIndexOffset = 0,
): string => {
    if (ref === undefined) return "t.void";
    const ownership = ffiOwnership(transfer);
    switch (ref.kind) {
        case "primitive":
            return primitiveExpression(ref.category, ownership);
        case "varargs":
            return "t.void";
        case "callback":
            return "t.void";
        case "named":
            return namedExpression(context, ref, ownership);
        case "array":
            return arrayExpression(context, ref, transfer, argIndexOffset);
        case "list": {
            if (ref.flavor === "gbytearray") return `t.byteArray(${quote(ownership)})`;
            const element = renderFfiType(context, ref.element, deriveElementTransfer(transfer), argIndexOffset);
            const helper = LIST_HELPERS[ref.flavor];
            return `t.${helper}(${element}, ${quote(ownership)})`;
        }
        case "hashtable": {
            const elementTransfer = deriveElementTransfer(transfer);
            const key = renderFfiType(context, ref.key, elementTransfer, argIndexOffset);
            const value = renderFfiType(context, ref.value, elementTransfer, argIndexOffset);
            return `t.hashTable(${key}, ${value}, ${quote(ownership)})`;
        }
    }
};

/**
 * A callback declaration resolved from a parameter type, together with the
 * namespace its parameter and return references belong to.
 */
export type ResolvedCallback = {
    readonly callback: GirCallback;
    readonly namespaceName: string;
};

/**
 * Resolves a parameter type reference to its callback declaration, whether
 * declared inline (`<callback>` child) or by name (a namespace-level
 * `<callback>`). Returns `undefined` for non-callback references.
 *
 * @param context - The module context
 * @param ref - The parameter type reference
 */
export const resolveCallbackType = (
    context: ModuleContext,
    ref: GirTypeRef | undefined,
): ResolvedCallback | undefined => {
    if (ref === undefined) return undefined;
    if (ref.kind === "callback")
        return { callback: callbackFromNode(ref.callback), namespaceName: context.namespace.name };
    if (ref.kind !== "named") return undefined;
    const owner = ref.namespaceName ?? context.namespace.name;
    const resolved = context.repository.resolveNamed(owner, ref.typeName);
    if (resolved === undefined || resolved.kind !== "callback") return undefined;
    return { callback: resolved.value, namespaceName: resolved.namespace.name };
};

/**
 * Whether a type reference is a scalar the native trampoline can read and
 * write through a `{ value }` cell: a non-string, non-void primitive, an enum or
 * flags type, or an alias resolving to one. Pointer-shaped types (strings,
 * objects, boxed records, arrays) are excluded — their out-parameter slots may
 * be uninitialized, so reading the incoming value would be unsound.
 *
 * @param repository - The GIR repository
 * @param namespaceName - The namespace the reference is resolved against
 * @param ref - The type reference
 */
export const isScalarRef = (repository: GirRepository, namespaceName: string, ref: GirTypeRef | undefined): boolean => {
    if (ref === undefined) return false;
    if (ref.kind === "primitive") return ref.category !== "string" && ref.category !== "void";
    if (ref.kind !== "named") return false;
    const resolved = repository.resolveNamed(ref.namespaceName ?? namespaceName, ref.typeName);
    if (resolved === undefined) return false;
    if (resolved.kind === "enum") return true;
    if (resolved.kind === "alias") {
        return resolved.targetRef !== undefined && isScalarRef(repository, resolved.namespace.name, resolved.targetRef);
    }
    return false;
};

/**
 * Whether an inout parameter marshals through a readable-and-writable
 * `{ value }` cell rather than being passed by handle and mutated in place.
 *
 * True for scalar inout parameters (see {@link isScalarRef}): the native
 * trampoline seeds the cell with the incoming value, the handler returns its
 * replacement in the tuple, and the cell is flushed back through the pointer.
 * Handle-passing inout parameters (objects, interfaces, boxed records) stay
 * plain arguments the handler mutates directly.
 *
 * @param context - The module context
 * @param parameter - The parameter to test
 */
export const isCellInout = (context: ModuleContext, parameter: GirParameter): boolean =>
    isInoutParameter(parameter) && isScalarRef(context.repository, context.namespace.name, parameter.type);

/**
 * Renders the `t.trampoline(...)` FFI descriptor for a callback parameter.
 *
 * The trampoline carries the callback's own argument and return FFI types,
 * the index of its `user_data` slot, and the owning parameter's `scope` plus
 * whether a paired `GDestroyNotify` is present. The native marshaller folds
 * the C-level callback, `user_data`, and destroy arguments into this single
 * descriptor. Returns `undefined` when `ref` is not a callback.
 *
 * @param context - The module context
 * @param ref - The parameter type reference
 * @param owningParameter - The parameter that carries the callback, for scope/destroy
 */
export const renderTrampolineType = (
    context: ModuleContext,
    ref: GirTypeRef | undefined,
    owningParameter: GirParameter,
): string | undefined => {
    const resolved = resolveCallbackType(context, ref);
    if (resolved === undefined) return undefined;
    const { callback, namespaceName } = resolved;
    const argTypes = callback.parameters.map((parameter) => {
        const ffi = renderFfiType(context, qualifyTypeRef(parameter.type, namespaceName), parameter.transferOwnership);
        return isOutParameter(parameter) || isCellInout(context, parameter) ? `t.ref(${ffi})` : ffi;
    });
    let userDataIndex: number | undefined;
    callback.parameters.forEach((parameter, index) => {
        if (parameter.name === "user_data" || parameter.name === "data") userDataIndex = index;
    });
    const returnRef = qualifyTypeRef(callback.returnValue.type, namespaceName);
    const isVoid = returnRef === undefined || (returnRef.kind === "primitive" && returnRef.category === "void");
    const returnType = isVoid ? "t.void" : renderFfiType(context, returnRef, callback.returnValue.transferOwnership);
    const options: string[] = [];
    if (owningParameter.destroyIndex !== undefined) options.push("hasDestroy: true");
    if (userDataIndex !== undefined) options.push(`userDataIndex: ${userDataIndex}`);
    if (owningParameter.scope !== undefined) options.push(`scope: ${quote(owningParameter.scope)}`);
    const optionsArg = options.length > 0 ? `, { ${options.join(", ")} }` : "";
    return `t.trampoline([${argTypes.join(", ")}], ${returnType}${optionsArg})`;
};

const LIST_HELPERS: Readonly<Record<"glist" | "gslist" | "gptrarray" | "garray" | "gbytearray", string>> = {
    glist: "list",
    gslist: "slist",
    gptrarray: "ptrArray",
    garray: "gArray",
    gbytearray: "byteArray",
};

const primitiveExpression = (
    category:
        | "void"
        | "boolean"
        | "int8"
        | "uint8"
        | "int16"
        | "uint16"
        | "int32"
        | "uint32"
        | "int64"
        | "uint64"
        | "float32"
        | "float64"
        | "string"
        | "unichar"
        | "pointer",
    ownership: "borrowed" | "full" | "none",
): string => {
    if (category === "void") return "t.void";
    if (category === "string") return `t.string(${quote(ownership)})`;
    if (category === "pointer") return "t.uint64";
    return `t.${category}`;
};

const namedExpression = (
    context: ModuleContext,
    ref: NamedTypeRef,
    ownership: "borrowed" | "full" | "none",
): string => {
    const namespaceName = ref.namespaceName ?? context.namespace.name;
    const resolved = context.repository.resolveNamed(namespaceName, ref.typeName);
    if (resolved === undefined) {
        return `t.object(${quote(ownership)})`;
    }
    return expressionForResolved(context, resolved, ownership);
};

/**
 * Ref/unref functions for fundamental types whose GIR record omits
 * `glib:ref-func`/`glib:unref-func` but which are nonetheless ref-counted
 * fundamentals (their `GType` is not a boxed type, so `g_boxed_free` aborts).
 * Keyed by GLib type name.
 */
const INTRINSIC_FUNDAMENTAL_FUNCS: ReadonlyMap<string, { readonly ref: string; readonly unref: string }> = new Map([
    ["GVariant", { ref: "g_variant_ref_sink", unref: "g_variant_unref" }],
]);

type FundamentalDescriptor = {
    readonly lib: string;
    readonly refFunc: string;
    readonly unrefFunc: string;
    readonly glibTypeName: string | undefined;
    readonly ownership: "borrowed" | "full" | "none";
};

/**
 * Translates a GLib ref-func into the function the FFI runtime calls to add an
 * independent reference.
 *
 * The runtime references a fundamental to make a defensive copy of a borrowed
 * return, to clone a handle, or to hand a callee its own reference for a
 * transfer-full argument — each must *add* a reference. GObject registers
 * `*_ref_sink` (e.g. `g_param_spec_ref_sink`, `g_variant_ref_sink`) as the
 * ref-func for floating types, but a sink only clears the floating flag on a
 * floating instance and adds no reference, so a wrapper built from it would
 * later unref a reference it never took and abort. The plain `*_ref`
 * counterpart adds a reference for floating and non-floating instances alike.
 */
const referenceAddingFunc = (refFunc: string): string =>
    refFunc.endsWith("_ref_sink") ? refFunc.slice(0, -"_sink".length) : refFunc;

const renderFundamental = (descriptor: FundamentalDescriptor): string => {
    const { lib, refFunc, unrefFunc, glibTypeName, ownership } = descriptor;
    const parts = [`ownership: ${quote(ownership)}`];
    if (glibTypeName !== undefined) parts.push(`typeName: ${quote(glibTypeName)}`);
    return `t.fundamental(${quote(lib)}, ${quote(referenceAddingFunc(refFunc))}, ${quote(unrefFunc)}, { ${parts.join(", ")} })`;
};

const classOrInterfaceExpression = (
    resolved: Extract<ResolvedNamed, { kind: "class" | "interface" }>,
    ownership: "borrowed" | "full" | "none",
): string => {
    const cls = resolved.value;
    if (cls.glibRefFunc === undefined || cls.glibUnrefFunc === undefined) {
        return `t.object(${quote(ownership)})`;
    }
    return renderFundamental({
        lib: resolved.namespace.sharedLibrary ?? "",
        refFunc: cls.glibRefFunc,
        unrefFunc: cls.glibUnrefFunc,
        glibTypeName: cls.glibTypeName,
        ownership,
    });
};

type AncestorFundamental = {
    readonly lib: string;
    readonly refFunc: string;
    readonly unrefFunc: string;
    readonly glibTypeName: string | undefined;
};

const fundamentalAncestor = (
    context: ModuleContext,
    namespaceName: string,
    typeName: string,
): AncestorFundamental | undefined => {
    const seen = new Set<string>();
    let owner = namespaceName;
    let name = typeName;
    while (!seen.has(`${owner}.${name}`)) {
        seen.add(`${owner}.${name}`);
        const resolved = context.repository.resolveNamed(owner, name);
        if (resolved === undefined || (resolved.kind !== "class" && resolved.kind !== "interface")) return undefined;
        const cls = resolved.value;
        if (cls.fundamental && cls.glibRefFunc !== undefined && cls.glibUnrefFunc !== undefined) {
            return {
                lib: resolved.namespace.sharedLibrary ?? "",
                refFunc: cls.glibRefFunc,
                unrefFunc: cls.glibUnrefFunc,
                glibTypeName: cls.glibTypeName,
            };
        }
        if (cls.parent === undefined) return undefined;
        const dot = cls.parent.indexOf(".");
        owner = dot === -1 ? resolved.namespace.name : cls.parent.slice(0, dot);
        name = dot === -1 ? cls.parent : cls.parent.slice(dot + 1);
    }
    return undefined;
};

/**
 * Renders the FFI descriptor for a method's instance (`self`) parameter.
 *
 * The receiver is always passed as a borrowed pointer regardless of the GIR
 * instance-parameter transfer (`transfer="full"` on e.g. `gdk_event_unref`
 * describes C-side consumption, not FFI ownership). A receiver whose ancestry
 * reaches a ref-counted fundamental (e.g. `GskRenderNode`) is marshalled as
 * `t.fundamental`; every other receiver — GObject subclasses and opaque
 * records alike — is a borrowed `t.object`.
 *
 * @param context - The module context
 * @param instance - The instance parameter
 */
export const renderSelfFfiType = (context: ModuleContext, instance: GirParameter): string => {
    const ref = instance.type;
    if (ref === undefined || ref.kind !== "named") return `t.object("borrowed")`;
    const owner = ref.namespaceName ?? context.namespace.name;
    const resolved = context.repository.resolveNamed(owner, ref.typeName);
    if (resolved === undefined) return `t.object("borrowed")`;
    if (resolved.kind === "class" || resolved.kind === "interface") {
        const ancestor = fundamentalAncestor(context, owner, ref.typeName);
        return ancestor === undefined
            ? `t.object("borrowed")`
            : renderFundamental({ ...ancestor, ownership: "borrowed" });
    }
    if (resolved.kind === "boxed" && isReferenceableBoxed(resolved.value)) {
        return boxedExpression(resolved, ffiOwnership(instance.transferOwnership));
    }
    return `t.object("borrowed")`;
};

const isReferenceableBoxed = (boxed: Extract<ResolvedNamed, { kind: "boxed" }>["value"]): boolean => {
    const hasRefPair =
        (boxed.glibRefFunc ?? boxed.copyFunc) !== undefined && (boxed.glibUnrefFunc ?? boxed.freeFunc) !== undefined;
    const hasIntrinsic = boxed.glibTypeName !== undefined && INTRINSIC_FUNDAMENTAL_FUNCS.has(boxed.glibTypeName);
    return hasRefPair || hasIntrinsic || boxed.glibGetType !== undefined;
};

const boxedExpression = (
    resolved: Extract<ResolvedNamed, { kind: "boxed" }>,
    ownership: "borrowed" | "full" | "none",
): string => {
    const boxed = resolved.value;
    const intrinsic =
        boxed.glibTypeName === undefined ? undefined : INTRINSIC_FUNDAMENTAL_FUNCS.get(boxed.glibTypeName);
    const refFunc = boxed.glibRefFunc ?? boxed.copyFunc ?? intrinsic?.ref;
    const unrefFunc = boxed.glibUnrefFunc ?? boxed.freeFunc ?? intrinsic?.unref;
    if (refFunc !== undefined && unrefFunc !== undefined) {
        const lib = resolved.namespace.sharedLibrary ?? "";
        return renderFundamental({ lib, refFunc, unrefFunc, glibTypeName: boxed.glibTypeName, ownership });
    }
    if (boxed.glibGetType === undefined) {
        return `t.struct(${quote(ownership)})`;
    }
    const glibName = boxed.glibTypeName ?? boxed.cType ?? boxed.name;
    const lib = resolved.namespace.sharedLibrary;
    const libExpr = lib === undefined ? "undefined" : quote(lib);
    return `t.boxed(${joinArgs([quote(glibName), quote(ownership), libExpr, quote(boxed.glibGetType)])})`;
};

const expressionForResolved = (
    context: ModuleContext,
    resolved: ResolvedNamed,
    ownership: "borrowed" | "full" | "none",
): string => {
    switch (resolved.kind) {
        case "class":
        case "interface":
            return classOrInterfaceExpression(resolved, ownership);
        case "boxed":
            return boxedExpression(resolved, ownership);
        case "enum": {
            const getter = resolved.value.glibGetType;
            const signed = resolved.value.members.some((member) => member.value.startsWith("-"));
            if (getter === undefined || getter === "") return signed ? "t.int32" : "t.uint32";
            const lib = resolved.namespace.sharedLibrary ?? "";
            const helper = resolved.value.kind === "bitfield" ? "flags" : "enum";
            return `t.${helper}(${quote(lib)}, ${quote(getter)}, ${String(signed)})`;
        }
        case "callback":
            return "t.void";
        case "alias":
            return aliasExpression(context, {
                namespace: resolved.namespace,
                targetRef: resolved.targetRef,
                ownership,
            });
    }
};

const arrayExpression = (
    context: ModuleContext,
    ref: ArrayTypeRef,
    transfer: ParameterTransfer,
    argIndexOffset: number,
): string => {
    const ownership = ffiOwnership(transfer);
    const element = renderFfiType(context, ref.element, deriveElementTransfer(transfer), argIndexOffset);
    const size = inlineElementSize(context, ref.element);
    const sizeArg = size === undefined ? "" : `, ${size}`;
    if (ref.lengthParameterIndex !== undefined) {
        return `t.sizedArray(${element}, ${ref.lengthParameterIndex + argIndexOffset}, ${quote(ownership)}${sizeArg})`;
    }
    if (ref.fixedSize !== undefined) {
        return `t.fixedArray(${element}, ${ref.fixedSize}, ${quote(ownership)}${sizeArg})`;
    }
    const optionsArg = size === undefined ? "" : `, { elementSize: ${size} }`;
    return `t.array(${element}, "array", ${quote(ownership)}${optionsArg})`;
};

/**
 * Computes the inline byte size of an array element when it is a by-value
 * boxed struct, so the native marshaller can lay out a contiguous element
 * buffer. Returns `undefined` for pointer elements (objects, strings, boxed
 * pointers) and primitives, which the native layer already sizes.
 */
const inlineElementSize = (context: ModuleContext, element: GirTypeRef | undefined): number | undefined => {
    if (element === undefined || element.kind !== "named") return undefined;
    const owner = element.namespaceName ?? context.namespace.name;
    const hardcoded = HARDCODED_INLINE_ELEMENT_SIZES.get(`${owner}.${element.typeName}`);
    if (hardcoded !== undefined) return hardcoded;
    if (element.cType?.includes("*")) return undefined;
    const resolved = context.repository.resolveNamed(owner, element.typeName);
    if (resolved === undefined || resolved.kind !== "boxed") return undefined;
    const boxed = resolved.value;
    if (boxed.opaque || boxed.disguised || boxed.fields.length === 0) return undefined;
    const { size } = computeBoxedFieldSlots(context, boxed.fields, boxed.isUnion);
    return size > 0 ? size : undefined;
};

type AliasExpressionOptions = {
    readonly namespace: GirNamespace;
    readonly targetRef: GirTypeRef | undefined;
    readonly ownership: "borrowed" | "full" | "none";
};

const aliasExpression = (context: ModuleContext, options: AliasExpressionOptions): string => {
    const { namespace, targetRef, ownership } = options;
    const qualified = qualifyTypeRef(targetRef, namespace.name);
    if (qualified === undefined) {
        return `t.object(${quote(ownership)})`;
    }
    return renderFfiType(context, qualified, ownership === "full" ? "full" : "none");
};
