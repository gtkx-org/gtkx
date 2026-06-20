import { quote } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import { joinArgs } from "../dsl/emit.js";
import type { GirCallback } from "../gir/callback.js";
import {
    type GirParameter,
    isCallerAllocatedOut,
    isInoutParameter,
    isOutParameter,
    type ParameterTransfer,
} from "../gir/parameter.js";
import type { PrimitiveCategory } from "../gir/primitives.js";
import type { GirRepository } from "../gir/repository.js";
import type { EntityType, GirType } from "../gir/type.js";
import type { CArrayType, TypeId } from "../gir/type-id.js";
import { computeBoxedFieldSlots } from "./boxed-layout.js";

/**
 * Maps a GIR transfer-ownership value to the FFI runtime's ownership
 * vocabulary.
 *
 * GIR `transfer none` becomes a `"borrowed"` defensive copy/reference, while
 * `transfer full` and `transfer container` (which owns the container) become
 * `"full"`. Callers pass the GIR string directly; this helper does the
 * translation.
 *
 * @param transfer - GIR transfer-ownership (`"none"`, `"full"`, `"container"`)
 */
const ffiOwnership = (transfer: ParameterTransfer): "borrowed" | "full" => {
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
 * Optional rendering controls for {@link renderFfiType} beyond the type and
 * its transfer.
 */
type RenderFfiTypeOptions = {
    /**
     * Offset added to a sized array's length-parameter index, so a method's
     * implicit instance receiver shifts the indices the descriptor records.
     */
    argIndexOffset?: number;
    /**
     * Marks a boxed or struct argument as a caller-allocated out parameter, so
     * the descriptor borrows the caller's buffer in place rather than copying.
     */
    callerAllocated?: boolean;
};

/**
 * Whether a type slot is void: an absent slot or a `void` primitive.
 *
 * @param repository - The GIR repository
 * @param ref - The interned type slot, or `undefined`
 */
export const isVoidRef = (repository: GirRepository, ref: TypeId | undefined): boolean => {
    if (ref === undefined) return true;
    const type = repository.typeOf(ref);
    return type?.kind === "primitive" && type.category === "void";
};

/**
 * Whether a type slot is an inline `<callback>` (a vtable slot's anonymous
 * function pointer) rather than a reference to a namespace-level callback type.
 * A named callback resolves to the same `callback` kind but carries a recoverable
 * name; only the anonymous inline form is a structural vtable slot.
 *
 * @param repository - The GIR repository
 * @param ref - The interned type slot, or `undefined`
 */
export const isInlineCallbackRef = (repository: GirRepository, ref: TypeId | undefined): boolean =>
    ref !== undefined && repository.typeOf(ref)?.kind === "callback" && repository.nameOf(ref) === undefined;

/**
 * Renders a TypeScript expression that materialises the FFI type
 * descriptor for `ref`.
 *
 * @param context - The module context (used for cross-namespace imports)
 * @param ref - The interned type slot, or `undefined` for void
 * @param transfer - GIR transfer-ownership conveyed onto the descriptor
 * @param options - Optional rendering controls (see {@link RenderFfiTypeOptions})
 */
export const renderFfiType = (
    context: ModuleContext,
    ref: TypeId | undefined,
    transfer: ParameterTransfer = "none",
    options: RenderFfiTypeOptions = {},
): string => {
    if (ref === undefined) return "t.void";
    const { argIndexOffset = 0, callerAllocated = false } = options;
    const ownership = ffiOwnership(transfer);
    const type = context.repository.typeOf(ref);
    if (type === undefined) return `t.object(${quote(ownership)})`;
    switch (type.kind) {
        case "primitive":
            return primitiveExpression(type.category, ownership);
        case "varargs":
        case "callback":
            return "t.void";
        case "class":
        case "interface":
        case "boxed":
        case "enum":
        case "alias":
            return expressionForResolved(context, type, ownership, callerAllocated);
        case "carray":
            return arrayExpression(context, type, transfer, argIndexOffset);
        case "list": {
            if (type.flavor === "gbytearray") return `t.byteArray(${quote(ownership)})`;
            const element = renderFfiType(context, type.element, deriveElementTransfer(transfer), { argIndexOffset });
            const helper = LIST_HELPERS[type.flavor];
            return `t.${helper}(${element}, ${quote(ownership)})`;
        }
        case "hashtable": {
            const elementTransfer = deriveElementTransfer(transfer);
            const key = renderFfiType(context, type.key, elementTransfer, { argIndexOffset });
            const value = renderFfiType(context, type.value, elementTransfer, { argIndexOffset });
            return `t.hashTable(${key}, ${value}, ${quote(ownership)})`;
        }
    }
};

/** A callback declaration resolved from a parameter type. */
export type ResolvedCallback = {
    readonly callback: GirCallback;
};

/**
 * Resolves a parameter type reference to its callback declaration, whether
 * declared inline or by name. Returns `undefined` for non-callback references.
 *
 * @param context - The module context
 * @param ref - The parameter type slot
 */
export const resolveCallbackType = (context: ModuleContext, ref: TypeId | undefined): ResolvedCallback | undefined => {
    if (ref === undefined) return undefined;
    const type = context.repository.typeOf(ref);
    if (type?.kind !== "callback") return undefined;
    return { callback: type.value };
};

/**
 * Whether a type reference is a scalar the native trampoline can read and
 * write through a `{ value }` cell: a non-string, non-void primitive, an enum or
 * flags type, or an alias resolving to one. Pointer-shaped types (strings,
 * objects, boxed records, arrays) are excluded — their out-parameter slots may
 * be uninitialized, so reading the incoming value would be unsound.
 *
 * @param repository - The GIR repository
 * @param ref - The interned type slot
 */
export const isScalarRef = (repository: GirRepository, ref: TypeId | undefined): boolean => {
    if (ref === undefined) return false;
    const type = repository.typeOf(ref);
    if (type === undefined) return false;
    if (type.kind === "primitive") return type.category !== "string" && type.category !== "void";
    if (type.kind === "enum") return true;
    if (type.kind === "alias") return type.target !== undefined && isScalarRef(repository, type.target);
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
    isInoutParameter(parameter) && isScalarRef(context.repository, parameter.type);

/**
 * Renders one handler-callback parameter's FFI descriptor — shared by vfunc
 * vtables, signal handlers, and callbacks. A scalar out/inout parameter becomes
 * a `t.ref` cell the native trampoline seeds and flushes back; a caller-allocated
 * out boxed/struct is marked so the trampoline reads it as a borrowed view of the
 * caller's buffer (filled in place); every other parameter renders plainly.
 *
 * @param context - The module context.
 * @param parameter - The parameter, supplying the out/caller-allocated predicates.
 * @param ref - The parameter's interned type slot.
 */
export const renderHandlerArgType = (
    context: ModuleContext,
    parameter: GirParameter,
    ref: TypeId | undefined,
): string => {
    if (isCellInout(context, parameter)) {
        return `t.ref(${renderFfiType(context, ref, parameter.transferOwnership)}, true)`;
    }
    if (isOutParameter(parameter)) {
        return `t.ref(${renderFfiType(context, ref, parameter.transferOwnership)})`;
    }
    return renderFfiType(context, ref, parameter.transferOwnership, {
        callerAllocated: isCallerAllocatedOut(parameter),
    });
};

/**
 * Renders the `t.callback(...)` FFI descriptor for a callback parameter.
 *
 * The descriptor carries the callback's own argument and return FFI types,
 * the index of its `user_data` slot, and the owning parameter's `scope` plus
 * whether a paired `GDestroyNotify` is present. The native marshaller folds
 * the C-level callback, `user_data`, and destroy arguments into this single
 * descriptor. Returns `undefined` when `ref` is not a callback.
 *
 * @param context - The module context
 * @param ref - The parameter type slot
 * @param owningParameter - The parameter that carries the callback, for scope/destroy
 */
export const renderCallbackType = (
    context: ModuleContext,
    ref: TypeId | undefined,
    owningParameter: GirParameter,
): string | undefined => {
    const resolved = resolveCallbackType(context, ref);
    if (resolved === undefined) return undefined;
    const { callback } = resolved;
    const argTypes = callback.parameters.map((parameter) => renderHandlerArgType(context, parameter, parameter.type));
    let userDataIndex: number | undefined;
    callback.parameters.forEach((parameter, index) => {
        if (parameter.name === "user_data" || parameter.name === "data") userDataIndex = index;
    });
    const returnRef = callback.returnValue.type;
    const returnType = isVoidRef(context.repository, returnRef)
        ? "t.void"
        : renderFfiType(context, returnRef, callback.returnValue.transferOwnership);
    const options: string[] = [];
    if (owningParameter.destroyIndex !== undefined) options.push("hasDestroy: true");
    if (userDataIndex !== undefined) options.push(`userDataIndex: ${userDataIndex}`);
    if (owningParameter.scope !== undefined) options.push(`scope: ${quote(owningParameter.scope)}`);
    const optionsArg = options.length > 0 ? `, { ${options.join(", ")} }` : "";
    return `t.callback([${argTypes.join(", ")}], ${returnType}${optionsArg})`;
};

const LIST_HELPERS: Readonly<Record<"glist" | "gslist" | "gptrarray" | "garray" | "gbytearray", string>> = {
    glist: "list",
    gslist: "slist",
    gptrarray: "ptrArray",
    garray: "garray",
    gbytearray: "byteArray",
};

const primitiveExpression = (category: PrimitiveCategory, ownership: "borrowed" | "full"): string => {
    if (category === "void") return "t.void";
    if (category === "string") return `t.string(${quote(ownership)})`;
    if (category === "pointer") return "t.uint64";
    if (category === "gtype") return "t.biguint64";
    return `t.${category}`;
};

type FundamentalDescriptor = {
    readonly lib: string;
    readonly refFunc: string;
    readonly unrefFunc: string;
    readonly glibTypeName: string | undefined;
    readonly ownership: "borrowed" | "full";
    readonly wrapperClass?: string;
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
    const { lib, refFunc, unrefFunc, glibTypeName, ownership, wrapperClass } = descriptor;
    const parts = [`ownership: ${quote(ownership)}`];
    if (glibTypeName !== undefined) parts.push(`typeName: ${quote(glibTypeName)}`);
    if (wrapperClass !== undefined) parts.push(`wrapperClass: ${wrapperClass}`);
    return `t.fundamental(${quote(lib)}, ${quote(referenceAddingFunc(refFunc))}, ${quote(unrefFunc)}, { ${parts.join(", ")} })`;
};

const classOrInterfaceExpression = (
    resolved: Extract<EntityType, { kind: "class" | "interface" }>,
    ownership: "borrowed" | "full",
): string => {
    const cls = resolved.value;
    if (cls.glibRefFunc === undefined || cls.glibUnrefFunc === undefined) {
        if (resolved.kind === "interface" && cls.glibTypeName !== undefined) {
            return `t.object(${joinArgs([quote(ownership), quote(cls.glibTypeName)])})`;
        }
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
    start: Extract<EntityType, { kind: "class" | "interface" }>,
): AncestorFundamental | undefined => {
    const seen = new Set<string>();
    let current: GirType | undefined = start;
    while (current !== undefined && (current.kind === "class" || current.kind === "interface")) {
        const key = `${current.namespace.name}.${current.value.name}`;
        if (seen.has(key)) return undefined;
        seen.add(key);
        const cls = current.value;
        if (cls.fundamental && cls.glibRefFunc !== undefined && cls.glibUnrefFunc !== undefined) {
            return {
                lib: current.namespace.sharedLibrary ?? "",
                refFunc: cls.glibRefFunc,
                unrefFunc: cls.glibUnrefFunc,
                glibTypeName: cls.glibTypeName,
            };
        }
        if (cls.parent === undefined) return undefined;
        current = context.repository.resolveType(current.namespace.name, cls.parent);
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
    if (ref === undefined) return `t.object("borrowed")`;
    const type = context.repository.typeOf(ref);
    if (type === undefined) return `t.object("borrowed")`;
    if (type.kind === "class" || type.kind === "interface") {
        const ancestor = fundamentalAncestor(context, type);
        return ancestor === undefined
            ? `t.object("borrowed")`
            : renderFundamental({ ...ancestor, ownership: "borrowed" });
    }
    if (type.kind === "boxed" && isReferenceableBoxed(type.value)) {
        return boxedExpression(context, type, ffiOwnership(instance.transferOwnership));
    }
    return `t.object("borrowed")`;
};

type ResolvedBoxed = Extract<EntityType, { kind: "boxed" }>["value"];

/**
 * The ref/unref function pair a boxed record marshals through, drawn in
 * precedence order from its GLib ref/unref funcs, then its copy/free funcs. A
 * record with both halves present renders as a `t.fundamental`; one with neither
 * renders as `t.boxed` (when it has a `get-type`) or a plain `t.struct`.
 */
const boxedRefPair = (
    boxed: ResolvedBoxed,
): { readonly refFunc: string | undefined; readonly unrefFunc: string | undefined } => ({
    refFunc: boxed.glibRefFunc ?? boxed.copyFunc,
    unrefFunc: boxed.glibUnrefFunc ?? boxed.freeFunc,
});

const isReferenceableBoxed = (boxed: ResolvedBoxed): boolean => {
    const hasRefPair =
        (boxed.glibRefFunc ?? boxed.copyFunc) !== undefined && (boxed.glibUnrefFunc ?? boxed.freeFunc) !== undefined;
    return hasRefPair || boxed.glibGetType !== undefined;
};

/**
 * Whether a boxed record's FFI descriptor carries no `GType` identity the
 * runtime can resolve a wrapper class from, so the binding pairs its wrapper
 * class with the descriptor. True for a plain `t.struct` (no copy/free pair, no
 * `get-type`) and for a `t.fundamental` with no registered GLib type name (e.g.
 * `GAsyncQueue`); false for a `t.boxed` (resolved through its `get-type`) and a
 * named `t.fundamental` (resolved through its type name).
 *
 * @param boxed - The resolved boxed record.
 */
const boxedNeedsFallbackClass = (boxed: ResolvedBoxed): boolean => {
    const { refFunc, unrefFunc } = boxedRefPair(boxed);
    if (refFunc !== undefined && unrefFunc !== undefined) return boxed.glibTypeName === undefined;
    return boxed.glibGetType === undefined;
};

/**
 * Renders a plain struct (a record with no boxed `GType`) as `t.struct(...)`,
 * carrying its computed byte size (so a borrowed value is copied retain-safe),
 * its fallback wrapper class, and the caller-allocated flag. The size is omitted
 * for a caller-allocated buffer, which is borrowed and filled in place.
 */
const structExpression = (
    context: ModuleContext,
    resolved: Extract<EntityType, { kind: "boxed" }>,
    ownership: "borrowed" | "full",
    callerAllocated: boolean,
): string => {
    const { size } = computeBoxedFieldSlots(context, resolved.value.fields, resolved.value.isUnion);
    const wrapperClass = context.qualify(resolved.namespace.name, resolved.value.name);
    const structOptions = joinArgs([
        size > 0 && !callerAllocated ? `size: ${size}` : undefined,
        `wrapperClass: ${wrapperClass}`,
        callerAllocated ? "callerAllocated: true" : undefined,
    ]);
    return structOptions === ""
        ? `t.struct(${quote(ownership)})`
        : `t.struct(${quote(ownership)}, { ${structOptions} })`;
};

const boxedExpression = (
    context: ModuleContext,
    resolved: Extract<EntityType, { kind: "boxed" }>,
    ownership: "borrowed" | "full",
    callerAllocated = false,
): string => {
    const boxed = resolved.value;
    const { refFunc, unrefFunc } = boxedRefPair(boxed);
    const wrapperClass = boxedNeedsFallbackClass(boxed)
        ? context.qualify(resolved.namespace.name, boxed.name)
        : undefined;
    if (refFunc !== undefined && unrefFunc !== undefined) {
        const lib = resolved.namespace.sharedLibrary ?? "";
        return renderFundamental({
            lib,
            refFunc,
            unrefFunc,
            glibTypeName: boxed.glibTypeName,
            ownership,
            wrapperClass,
        });
    }
    if (boxed.glibGetType === undefined) {
        return structExpression(context, resolved, ownership, callerAllocated);
    }
    const glibName = boxed.glibTypeName ?? boxed.cType ?? boxed.name;
    const lib = resolved.namespace.sharedLibrary;
    const libExpr = lib === undefined ? "undefined" : quote(lib);
    return `t.boxed(${joinArgs([
        quote(glibName),
        quote(ownership),
        libExpr,
        quote(boxed.glibGetType),
        callerAllocated ? "undefined" : undefined,
        callerAllocated ? "{ callerAllocated: true }" : undefined,
    ])})`;
};

const expressionForResolved = (
    context: ModuleContext,
    resolved: Extract<EntityType, { kind: "class" | "interface" | "boxed" | "enum" | "alias" }>,
    ownership: "borrowed" | "full",
    callerAllocated = false,
): string => {
    switch (resolved.kind) {
        case "class":
        case "interface":
            return classOrInterfaceExpression(resolved, ownership);
        case "boxed":
            return boxedExpression(context, resolved, ownership, callerAllocated);
        case "enum": {
            const getter = resolved.value.glibGetType;
            const signed = resolved.value.members.some((member) => member.value.startsWith("-"));
            if (getter === undefined || getter === "") return signed ? "t.int32" : "t.uint32";
            const lib = resolved.namespace.sharedLibrary ?? "";
            const helper = resolved.value.kind === "bitfield" ? "flags" : "enum";
            return `t.${helper}(${quote(lib)}, ${quote(getter)}, ${String(signed)})`;
        }
        case "alias":
            return aliasExpression(context, resolved.target, ownership);
    }
};

const arrayExpression = (
    context: ModuleContext,
    ref: CArrayType,
    transfer: ParameterTransfer,
    argIndexOffset: number,
): string => {
    const ownership = ffiOwnership(transfer);
    const element = renderFfiType(context, ref.element, deriveElementTransfer(transfer), { argIndexOffset });
    const size = inlineElementSize(context, ref.element, ref.elementCType);
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
const inlineElementSize = (
    context: ModuleContext,
    element: TypeId | undefined,
    elementCType: string | undefined,
): number | undefined => {
    if (element === undefined) return undefined;
    if (elementCType?.includes("*")) return undefined;
    const type = context.repository.typeOf(element);
    if (type?.kind !== "boxed") return undefined;
    const boxed = type.value;
    if (boxed.opaque || boxed.disguised || boxed.fields.length === 0) return undefined;
    const { size } = computeBoxedFieldSlots(context, boxed.fields, boxed.isUnion);
    return size > 0 ? size : undefined;
};

const aliasExpression = (
    context: ModuleContext,
    target: TypeId | undefined,
    ownership: "borrowed" | "full",
): string => {
    if (target === undefined) {
        return `t.object(${quote(ownership)})`;
    }
    return renderFfiType(context, target, ownership === "full" ? "full" : "none");
};
