import { quote } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
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
import {
    type ListDescriptorName,
    type Ownership,
    type ScalarDescriptorName,
    tArray,
    tBigUint64,
    tBoxed,
    tByteArray,
    tCallback,
    tEnum,
    tFixedArray,
    tFlags,
    tFundamental,
    tHashTable,
    tInt32,
    tList,
    tObject,
    tRef,
    tScalar,
    tSizedArray,
    tString,
    tStruct,
    tUint32,
    tUint64,
    tVoid,
} from "./descriptor.js";

const ffiOwnership = (transfer: ParameterTransfer): Ownership => {
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
    if (ref === undefined) return tVoid;
    const { argIndexOffset = 0, callerAllocated = false } = options;
    const ownership = ffiOwnership(transfer);
    const type = context.repository.typeOf(ref);
    if (type === undefined) return tObject(ownership);
    switch (type.kind) {
        case "primitive":
            return primitiveExpression(type.category, ownership);
        case "varargs":
        case "callback":
            return tVoid;
        case "class":
        case "interface":
        case "boxed":
        case "enum":
        case "alias":
            return expressionForResolved(context, type, ownership, callerAllocated);
        case "carray":
            return arrayExpression(context, type, transfer, argIndexOffset);
        case "list": {
            if (type.flavor === "gbytearray") return tByteArray(ownership);
            const element = renderFfiType(context, type.element, deriveElementTransfer(transfer), { argIndexOffset });
            return tList(LIST_HELPERS[type.flavor], element, ownership);
        }
        case "hashtable": {
            const elementTransfer = deriveElementTransfer(transfer);
            const key = renderFfiType(context, type.key, elementTransfer, { argIndexOffset });
            const value = renderFfiType(context, type.value, elementTransfer, { argIndexOffset });
            return tHashTable(key, value, ownership);
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
        return tRef(renderFfiType(context, ref, parameter.transferOwnership), true);
    }
    if (isOutParameter(parameter)) {
        return tRef(renderFfiType(context, ref, parameter.transferOwnership));
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
        ? tVoid
        : renderFfiType(context, returnRef, callback.returnValue.transferOwnership);
    const options: string[] = [];
    if (owningParameter.destroyIndex !== undefined) options.push("hasDestroy: true");
    if (userDataIndex !== undefined) options.push(`userDataIndex: ${userDataIndex}`);
    if (owningParameter.scope !== undefined) options.push(`scope: ${quote(owningParameter.scope)}`);
    const optionsArg = options.length > 0 ? `{ ${options.join(", ")} }` : undefined;
    return tCallback(argTypes, returnType, optionsArg);
};

const LIST_HELPERS: Record<Exclude<ListFlavor, "gbytearray">, ListDescriptorName> = {
    glist: "list",
    gslist: "slist",
    gptrarray: "ptrArray",
    garray: "garray",
};

const primitiveExpression = (category: PrimitiveCategory, ownership: Ownership): string => {
    if (category === "void") return tVoid;
    if (category === "string") return tString(ownership);
    if (category === "pointer") return tUint64;
    if (category === "gtype") return tBigUint64;
    return tScalar(category satisfies ScalarDescriptorName);
};

type FundamentalDescriptor = {
    lib: string;
    refFunc: string;
    unrefFunc: string;
    glibTypeName: string | undefined;
    ownership: Ownership;
    wrapperClass?: string | undefined;
};

const referenceAddingFunc = (refFunc: string): string =>
    refFunc.endsWith("_ref_sink") ? refFunc.slice(0, -"_sink".length) : refFunc;

const renderFundamental = (descriptor: FundamentalDescriptor): string => {
    const { lib, refFunc, unrefFunc, glibTypeName, ownership, wrapperClass } = descriptor;
    return tFundamental(lib, referenceAddingFunc(refFunc), unrefFunc, {
        ownership,
        typeName: glibTypeName,
        wrapperClass,
    });
};

const classOrInterfaceExpression = (
    resolved: Extract<EntityType, { kind: "class" | "interface" }>,
    ownership: Ownership,
): string => {
    const cls = resolved.value;
    if (cls.glibRefFunc === undefined || cls.glibUnrefFunc === undefined) {
        if (resolved.kind === "interface" && cls.glibTypeName !== undefined) {
            return tObject(ownership, cls.glibTypeName);
        }
        return tObject(ownership);
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
    if (ref === undefined) return tObject("borrowed");
    const type = context.repository.typeOf(ref);
    if (type === undefined) return tObject("borrowed");
    if (type.kind === "class" || type.kind === "interface") {
        const ancestor = fundamentalAncestor(context, type);
        return ancestor === undefined ? tObject("borrowed") : renderFundamental({ ...ancestor, ownership: "borrowed" });
    }
    if (type.kind === "boxed" && isReferenceableBoxed(type.value)) {
        return boxedExpression(context, type, ffiOwnership(instance.transferOwnership));
    }
    return tObject("borrowed");
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
    ownership: Ownership,
    callerAllocated: boolean,
): string => {
    const { size } = computeBoxedFieldSlots(context, resolved.value.fields, resolved.value.isUnion);
    const wrapperClass = context.qualify(resolved.namespace.name, resolved.value.name);
    return tStruct(ownership, {
        size: size > 0 && !callerAllocated ? size : undefined,
        wrapperClass,
        callerAllocated,
    });
};

const boxedExpression = (
    context: ModuleContext,
    resolved: Extract<EntityType, { kind: "boxed" }>,
    ownership: Ownership,
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
    return tBoxed(glibName, {
        ownership,
        library: resolved.namespace.sharedLibrary,
        getTypeFn: boxed.glibGetType,
        callerAllocated,
    });
};

const expressionForResolved = (
    context: ModuleContext,
    resolved: Extract<EntityType, { kind: "class" | "interface" | "boxed" | "enum" | "alias" }>,
    ownership: Ownership,
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
            if (getter === undefined || getter === "") return signed ? tInt32 : tUint32;
            const lib = resolved.namespace.sharedLibrary ?? "";
            return resolved.value.kind === "bitfield" ? tFlags(lib, getter, signed) : tEnum(lib, getter, signed);
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
    if (ref.lengthParameterIndex !== undefined) {
        return tSizedArray(element, ref.lengthParameterIndex + argIndexOffset, ownership, size);
    }
    if (ref.fixedSize !== undefined) {
        return tFixedArray(element, ref.fixedSize, ownership, size);
    }
    return tArray(element, "array", ownership, size);
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

const aliasExpression = (context: ModuleContext, target: TypeId | undefined, ownership: Ownership): string => {
    if (target === undefined) {
        return tObject(ownership);
    }
    return renderFfiType(context, target, ownership === "full" ? "full" : "none");
};
