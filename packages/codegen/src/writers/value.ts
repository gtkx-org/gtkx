import { quote } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import { joinArgs } from "../dsl/emit.js";
import type { GirCallback } from "../gir/callback.js";
import {
    type GirParameter,
    type GirReturnValue,
    isCallerAllocatedOut,
    isInoutParameter,
    isOutParameter,
    type ParameterTransfer,
} from "../gir/parameter.js";
import type { PrimitiveCategory } from "../gir/primitives.js";
import type { GirRepository } from "../gir/repository.js";
import type { EntityType, GirType } from "../gir/type.js";
import type { CArrayType, ListFlavor, TypeId } from "../gir/type-id.js";
import { computeBoxedFieldSlots } from "./boxed-layout.js";

const ffiOwnership = (transfer: ParameterTransfer): "borrowed" | "full" => {
    if (transfer === "full") return "full";
    if (transfer === "container") return "full";
    return "borrowed";
};

const deriveElementTransfer = (transfer: ParameterTransfer): ParameterTransfer =>
    transfer === "container" ? "none" : transfer;

type RenderFfiTypeOptions = {
    argIndexOffset?: number;
    callerAllocated?: boolean;
};

export const isVoidRef = (repository: GirRepository, ref: TypeId | undefined): boolean => {
    if (ref === undefined) return true;
    const type = repository.typeOf(ref);
    return type?.kind === "primitive" && type.category === "void";
};

export const isInlineCallbackRef = (repository: GirRepository, ref: TypeId | undefined): boolean =>
    ref !== undefined && repository.typeOf(ref)?.kind === "callback" && repository.nameOf(ref) === undefined;

export const omitsPrimaryReturn = (repository: GirRepository, returnValue: GirReturnValue): boolean =>
    isVoidRef(repository, returnValue.type) || returnValue.skip;

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

export type ResolvedCallback = {
    callback: GirCallback;
};

export const resolveCallbackType = (context: ModuleContext, ref: TypeId | undefined): ResolvedCallback | undefined => {
    if (ref === undefined) return undefined;
    const type = context.repository.typeOf(ref);
    if (type?.kind !== "callback") return undefined;
    return { callback: type.value };
};

export const isScalarRef = (repository: GirRepository, ref: TypeId | undefined): boolean => {
    if (ref === undefined) return false;
    const type = repository.typeOf(ref);
    if (type === undefined) return false;
    if (type.kind === "primitive") return type.category !== "string" && type.category !== "void";
    if (type.kind === "enum") return true;
    if (type.kind === "alias") return type.target !== undefined && isScalarRef(repository, type.target);
    return false;
};

export const isCellInout = (context: ModuleContext, parameter: GirParameter): boolean =>
    isInoutParameter(parameter) && isScalarRef(context.repository, parameter.type);

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

const LIST_HELPERS: Record<ListFlavor, string> = {
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
    lib: string;
    refFunc: string;
    unrefFunc: string;
    glibTypeName: string | undefined;
    ownership: "borrowed" | "full";
    wrapperClass?: string | undefined;
};

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
    lib: string;
    refFunc: string;
    unrefFunc: string;
    glibTypeName: string | undefined;
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

const boxedRefPair = (boxed: ResolvedBoxed): { refFunc: string | undefined; unrefFunc: string | undefined } => ({
    refFunc: boxed.glibRefFunc ?? boxed.copyFunc,
    unrefFunc: boxed.glibUnrefFunc ?? boxed.freeFunc,
});

const isReferenceableBoxed = (boxed: ResolvedBoxed): boolean => {
    const hasRefPair =
        (boxed.glibRefFunc ?? boxed.copyFunc) !== undefined && (boxed.glibUnrefFunc ?? boxed.freeFunc) !== undefined;
    return hasRefPair || boxed.glibGetType !== undefined;
};

const boxedNeedsFallbackClass = (boxed: ResolvedBoxed): boolean => {
    const { refFunc, unrefFunc } = boxedRefPair(boxed);
    if (refFunc !== undefined && unrefFunc !== undefined) return boxed.glibTypeName === undefined;
    return boxed.glibGetType === undefined;
};

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
