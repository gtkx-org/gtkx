import { sourceStringLiteral } from "@gtkx/utils";
import type { GirCallback } from "../gir/callback.js";
import type { Library } from "../gir/library.js";
import {
    type GirParameter,
    type GirReturnValue,
    isCallerAllocatedOut,
    isInoutParameter,
    isOutParameter,
    type ParameterTransfer,
} from "../gir/parameter.js";
import type { PrimitiveCategory } from "../gir/primitives.js";
import type { EntityType, GirType } from "../gir/type.js";
import type { CArrayType, ListFlavor, TypeId } from "../gir/type-id.js";
import { isRecordInout } from "../store/gi/param-marshal.js";
import { computeRecordFieldSlots } from "../store/gi/record-layout.js";
import type { ModuleContext } from "../writer/context.js";
import {
    type ListDescriptorName,
    type Ownership,
    type ScalarDescriptorName,
    tArray,
    tBoxed,
    tByteArray,
    tCallback,
    tEnum,
    tFixedArray,
    tFlags,
    tFundamental,
    tGtype,
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

const transferOwnership = (transfer: ParameterTransfer): Ownership => {
    if (transfer === "full") return "full";
    if (transfer === "container") return "full";
    return "borrowed";
};

const deriveElementTransfer = (transfer: ParameterTransfer): ParameterTransfer =>
    transfer === "container" ? "none" : transfer;

type RenderDescriptorOptions = {
    argIndexOffset?: number;
    callerAllocated?: boolean;
};

const isVoidRef = (library: Library, ref: TypeId | undefined): boolean => {
    if (ref === undefined) return true;
    const type = library.typeOf(ref);
    return type?.kind === "primitive" && type.category === "void";
};

export const isInlineCallbackRef = (library: Library, ref: TypeId | undefined): boolean =>
    ref !== undefined && library.typeOf(ref)?.kind === "callback" && library.nameOf(ref) === undefined;

export const omitsPrimaryReturn = (library: Library, returnValue: GirReturnValue): boolean =>
    isVoidRef(library, returnValue.type) || returnValue.skip;

export const renderDescriptor = (
    context: ModuleContext,
    ref: TypeId | undefined,
    transfer: ParameterTransfer = "none",
    options: RenderDescriptorOptions = {},
): string => {
    if (ref === undefined) return tVoid;
    const { argIndexOffset = 0 } = options;
    const ownership = transferOwnership(transfer);
    const type = context.library.typeOf(ref);
    if (type === undefined) return tObject(ownership);
    switch (type.kind) {
        case "primitive":
            return primitiveExpression(type.category, ownership);
        case "varargs":
        case "callback":
            return tVoid;
        case "class":
        case "interface":
        case "record":
        case "enum":
        case "alias":
            return expressionForResolved(context, type, transfer, options);
        case "carray":
            return arrayExpression(context, type, transfer, argIndexOffset);
        case "list": {
            if (type.flavor === "gbytearray") return tByteArray(ownership);
            const element = renderDescriptor(context, type.element, deriveElementTransfer(transfer), {
                argIndexOffset,
            });
            return tList(LIST_HELPERS[type.flavor], element, ownership);
        }
        case "hashtable": {
            const elementTransfer = deriveElementTransfer(transfer);
            const key = renderDescriptor(context, type.key, elementTransfer, { argIndexOffset });
            const value = renderDescriptor(context, type.value, elementTransfer, { argIndexOffset });
            return tHashTable(key, value, ownership);
        }
    }
};

const resolveCallbackType = (context: ModuleContext, ref: TypeId | undefined): GirCallback | undefined => {
    if (ref === undefined) return undefined;
    const type = context.library.typeOf(ref);
    if (type?.kind !== "callback") return undefined;
    return type.value;
};

export const isScalarRef = (library: Library, ref: TypeId | undefined): boolean => {
    if (ref === undefined) return false;
    const type = library.typeOf(ref);
    if (type === undefined) return false;
    if (type.kind === "primitive") return type.category !== "string" && type.category !== "void";
    if (type.kind === "enum") return true;
    if (type.kind === "alias") return type.value.target !== undefined && isScalarRef(library, type.value.target);
    return false;
};

export const isCellInout = (library: Library, parameter: GirParameter): boolean =>
    isInoutParameter(parameter) && isScalarRef(library, parameter.type);

export const renderParamDescriptor = (
    context: ModuleContext,
    parameter: GirParameter,
    ref: TypeId | undefined,
): string => {
    if (isCellInout(context.library, parameter)) {
        return tRef(renderDescriptor(context, ref, parameter.transferOwnership), true);
    }
    if (isOutParameter(parameter)) {
        return tRef(renderDescriptor(context, ref, parameter.transferOwnership));
    }
    return renderDescriptor(context, ref, parameter.transferOwnership, {
        callerAllocated: isCallerAllocatedOut(parameter) || isRecordInout(context, parameter),
    });
};

export const renderCallbackType = (
    context: ModuleContext,
    ref: TypeId | undefined,
    owningParameter: GirParameter,
    argOverrides?: Map<number, string>,
): string | undefined => {
    const callback = resolveCallbackType(context, ref);
    if (callback === undefined) return undefined;
    const argTypes = callback.parameters.map(
        (parameter, index) => argOverrides?.get(index) ?? renderParamDescriptor(context, parameter, parameter.type),
    );
    let userDataIndex: number | undefined;
    callback.parameters.forEach((parameter, index) => {
        if (parameter.name === "user_data" || parameter.name === "data") userDataIndex = index;
    });
    const returnRef = callback.returnValue.type;
    const returnType = isVoidRef(context.library, returnRef)
        ? tVoid
        : renderDescriptor(context, returnRef, callback.returnValue.transferOwnership);
    const options: string[] = [];
    if (owningParameter.destroyIndex !== undefined) options.push("hasDestroy: true");
    if (userDataIndex !== undefined) options.push(`userDataIndex: ${userDataIndex}`);
    if (owningParameter.scope !== undefined) options.push(`scope: ${sourceStringLiteral(owningParameter.scope)}`);
    const optionsArg = options.length > 0 ? `{ ${options.join(", ")} }` : undefined;
    return tCallback(argTypes, returnType, optionsArg);
};

const LIST_HELPERS: Record<Exclude<ListFlavor, "gbytearray">, ListDescriptorName> = {
    glist: "list",
    gslist: "slist",
    gptrarray: "ptrArray",
    garray: "gArray",
};

const primitiveExpression = (category: PrimitiveCategory, ownership: Ownership): string => {
    if (category === "void") return tVoid;
    if (category === "string") return tString(ownership);
    if (category === "pointer") return tUint64;
    if (category === "gtype") return tGtype;
    return tScalar(category satisfies ScalarDescriptorName);
};

type FundamentalDescriptor = {
    lib: string;
    refFunc: string;
    unrefFunc: string;
    typeName: string | undefined;
    ownership: Ownership;
    wrapperClass?: string | undefined;
};

const referenceAddingFunc = (refFunc: string): string =>
    refFunc.endsWith("_ref_sink") ? refFunc.slice(0, -"_sink".length) : refFunc;

const renderFundamental = (descriptor: FundamentalDescriptor): string => {
    const { lib, refFunc, unrefFunc, typeName, ownership, wrapperClass } = descriptor;
    return tFundamental(lib, referenceAddingFunc(refFunc), unrefFunc, {
        ownership,
        typeName,
        wrapperClass,
    });
};

const classOrInterfaceExpression = (
    resolved: Extract<EntityType, { kind: "class" | "interface" }>,
    ownership: Ownership,
): string => {
    const cls = resolved.value;
    if (cls.glibRefFunc === undefined || cls.glibUnrefFunc === undefined) {
        return tObject(ownership);
    }
    return renderFundamental({
        lib: resolved.namespace.sharedLibrary ?? "",
        refFunc: cls.glibRefFunc,
        unrefFunc: cls.glibUnrefFunc,
        typeName: cls.glibTypeName,
        ownership,
    });
};

type AncestorFundamental = {
    lib: string;
    refFunc: string;
    unrefFunc: string;
    typeName: string | undefined;
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
                typeName: cls.glibTypeName,
            };
        }
        if (cls.parent === undefined) return undefined;
        current = context.library.resolveType(current.namespace.name, cls.parent);
    }
    return undefined;
};

export const renderSelfDescriptor = (context: ModuleContext, instance: GirParameter): string => {
    const ref = instance.type;
    if (ref === undefined) return tObject("borrowed");
    const type = context.library.typeOf(ref);
    if (type === undefined) return tObject("borrowed");
    if (type.kind === "class" || type.kind === "interface") {
        const ancestor = fundamentalAncestor(context, type);
        return ancestor === undefined ? tObject("borrowed") : renderFundamental({ ...ancestor, ownership: "borrowed" });
    }
    if (type.kind === "record") {
        return recordExpression(context, type, transferOwnership(instance.transferOwnership));
    }
    return tObject("borrowed");
};

type ResolvedRecord = Extract<EntityType, { kind: "record" }>["value"];

const recordRefPair = (record: ResolvedRecord): { refFunc: string | undefined; unrefFunc: string | undefined } => ({
    refFunc: record.glibRefFunc ?? record.copyFunc,
    unrefFunc: record.glibUnrefFunc ?? record.freeFunc,
});

const recordNeedsFallbackClass = (record: ResolvedRecord): boolean => {
    const { refFunc, unrefFunc } = recordRefPair(record);
    if (refFunc !== undefined && unrefFunc !== undefined) return record.glibTypeName === undefined;
    return record.glibGetType === undefined;
};

const structExpression = (
    context: ModuleContext,
    resolved: Extract<EntityType, { kind: "record" }>,
    ownership: Ownership,
    callerAllocated: boolean,
): string => {
    const { size } = computeRecordFieldSlots(context, resolved.value.fields, resolved.value.isUnion);
    const wrapperClass = context.qualify(resolved.namespace.name, resolved.value.name);
    return tStruct(ownership, {
        size: size > 0 ? size : undefined,
        wrapperClass,
        callerAllocated,
    });
};

const recordExpression = (
    context: ModuleContext,
    resolved: Extract<EntityType, { kind: "record" }>,
    ownership: Ownership,
    callerAllocated = false,
): string => {
    const record = resolved.value;
    const { refFunc, unrefFunc } = recordRefPair(record);
    const wrapperClass = recordNeedsFallbackClass(record)
        ? context.qualify(resolved.namespace.name, record.name)
        : undefined;
    if (refFunc !== undefined && unrefFunc !== undefined) {
        const lib = resolved.namespace.sharedLibrary ?? "";
        return renderFundamental({
            lib,
            refFunc,
            unrefFunc,
            typeName: record.glibTypeName,
            ownership,
            wrapperClass,
        });
    }
    if (record.glibGetType === undefined) {
        return structExpression(context, resolved, ownership, callerAllocated);
    }
    const glibName = record.glibTypeName ?? record.cType ?? record.name;
    const { size } = computeRecordFieldSlots(context, record.fields, record.isUnion);
    return tBoxed(glibName, {
        ownership,
        sharedLibrary: resolved.namespace.sharedLibrary,
        getTypeFnName: record.glibGetType,
        callerAllocated,
        size: size > 0 ? size : undefined,
    });
};

const expressionForResolved = (
    context: ModuleContext,
    resolved: Extract<EntityType, { kind: "class" | "interface" | "record" | "enum" | "alias" }>,
    transfer: ParameterTransfer,
    options: RenderDescriptorOptions,
): string => {
    const ownership = transferOwnership(transfer);
    switch (resolved.kind) {
        case "class":
        case "interface":
            return classOrInterfaceExpression(resolved, ownership);
        case "record":
            return recordExpression(context, resolved, ownership, options.callerAllocated ?? false);
        case "enum": {
            const getter = resolved.value.glibGetType;
            const signed = resolved.value.members.some((member) => member.value.startsWith("-"));
            if (getter === undefined || getter === "") return signed ? tInt32 : tUint32;
            const lib = resolved.namespace.sharedLibrary ?? "";
            return resolved.value.kind === "bitfield" ? tFlags(lib, getter, signed) : tEnum(lib, getter, signed);
        }
        case "alias":
            return aliasExpression(context, resolved.value.target, transfer, options);
    }
};

const arrayExpression = (
    context: ModuleContext,
    ref: CArrayType,
    transfer: ParameterTransfer,
    argIndexOffset: number,
): string => {
    const ownership = transferOwnership(transfer);
    const element = renderDescriptor(context, ref.element, deriveElementTransfer(transfer), { argIndexOffset });
    const size = inlineElementSize(context, ref.element, ref.elementCType);
    if (ref.lengthParameterIndex !== undefined) {
        return tSizedArray(element, ref.lengthParameterIndex + argIndexOffset, ownership, size);
    }
    if (ref.fixedSize !== undefined) {
        return tFixedArray(element, ref.fixedSize, ownership, size);
    }
    return tArray(element, ownership, size);
};

const inlineElementSize = (
    context: ModuleContext,
    element: TypeId | undefined,
    elementCType: string | undefined,
): number | undefined => {
    if (element === undefined) return undefined;
    if (elementCType?.includes("*")) return undefined;
    const type = context.library.typeOf(element);
    if (type?.kind !== "record") return undefined;
    const record = type.value;
    if (record.opaque || record.disguised || record.fields.length === 0) return undefined;
    const { size } = computeRecordFieldSlots(context, record.fields, record.isUnion);
    return size > 0 ? size : undefined;
};

const aliasExpression = (
    context: ModuleContext,
    target: TypeId | undefined,
    transfer: ParameterTransfer,
    options: RenderDescriptorOptions,
): string => {
    if (target === undefined) {
        return tObject(transferOwnership(transfer));
    }
    return renderDescriptor(context, target, transfer, options);
};
