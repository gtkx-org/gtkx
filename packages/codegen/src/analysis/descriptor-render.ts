import { sourceStringLiteral } from "@gtkx/utils";
import type { GirCallback } from "../gir/callback.js";
import type { Library } from "../gir/library.js";
import type { PrimitiveCategory } from "../gir/primitives.js";
import type { CArrayType, ListFlavor, TypeId } from "../gir/type-id.js";
import type { EntityType, GirType } from "../gir/type.js";
import type { ModuleContext } from "../writer/context.js";
import {
    type GirParameter,
    type GirReturnValue,
    isCallerAllocatedOut,
    isInoutParameter,
    isOutParameter,
    type ParameterTransfer,
} from "../gir/parameter.js";
import { isRecordInout } from "../store/gi/param-marshal.js";
import { computeRecordFieldSlots } from "../store/gi/record-layout.js";
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

type RenderDescriptorOptions = {
    argIndexOffset?: number;
    callerAllocated?: boolean;
};

type FundamentalDescriptor = {
    lib: string;
    refFunc: string;
    unrefFunc: string;
    typeName: string | undefined;
    ownership: Ownership;
    wrapperClass?: string | undefined;
};

type AncestorFundamental = {
    lib: string;
    refFunc: string;
    unrefFunc: string;
    typeName: string | undefined;
};

type ResolvedRecord = Extract<EntityType, { kind: "record" }>["value"];

type FundamentalRecordOptions = {
    resolved: Extract<EntityType, { kind: "record" }>;
    refFunc: string;
    unrefFunc: string;
    ownership: Ownership;
    wrapperClass: string | undefined;
};

const LIST_HELPERS: Record<Exclude<ListFlavor, "gbytearray">, ListDescriptorName> = {
    glist: "list",
    gslist: "slist",
    gptrarray: "ptrArray",
    garray: "gArray",
};

const transferOwnership = (transfer: ParameterTransfer): Ownership => {
    if (transfer === "full") return "full";
    if (transfer === "container") return "full";
    return "borrowed";
};

const deriveElementTransfer = (transfer: ParameterTransfer): ParameterTransfer =>
    transfer === "container" ? "none" : transfer;

const isVoidRef = (library: Library, ref: TypeId | undefined): boolean => {
    if (ref === undefined) return true;
    const type = library.typeOf(ref);
    return type?.kind === "primitive" && type.category === "void";
};

const isInlineCallbackRef = (library: Library, ref: TypeId | undefined): boolean =>
    ref !== undefined && library.typeOf(ref)?.kind === "callback" && library.nameOf(ref) === undefined;

const omitsPrimaryReturn = (library: Library, returnValue: GirReturnValue): boolean =>
    isVoidRef(library, returnValue.type) || returnValue.skip;

const renderDescriptor = (
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
        case "primitive": {
            return primitiveExpression(type.category, ownership);
        }
        case "varargs":
        case "callback": {
            return tVoid;
        }
        case "class":
        case "interface":
        case "record":
        case "enum":
        case "alias": {
            return expressionForResolved(context, type, transfer, options);
        }
        case "carray": {
            return arrayExpression(context, type, transfer, argIndexOffset);
        }
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

const isScalarType = (library: Library, type: GirType): boolean => {
    switch (type.kind) {
        case "primitive": {
            return type.category !== "string" && type.category !== "void";
        }
        case "enum": {
            return true;
        }
        case "alias": {
            return type.value.target !== undefined && isScalarRef(library, type.value.target);
        }
        default: {
            return false;
        }
    }
};

const isScalarRef = (library: Library, ref: TypeId | undefined): boolean => {
    if (ref === undefined) return false;
    const type = library.typeOf(ref);
    return type !== undefined && isScalarType(library, type);
};

const isCellInout = (library: Library, parameter: GirParameter): boolean =>
    isInoutParameter(parameter) && isScalarRef(library, parameter.type);

const renderParamDescriptor = (
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

const findUserDataIndex = (parameters: GirParameter[]): number | undefined => {
    let userDataIndex: number | undefined;

    for (const [index, parameter] of parameters.entries()) {
        if (parameter.name === "user_data" || parameter.name === "data") userDataIndex = index;
    }

    return userDataIndex;
};

const callbackOptionsArg = (owningParameter: GirParameter, userDataIndex: number | undefined): string | undefined => {
    const options: string[] = [];
    if (owningParameter.destroyIndex !== undefined) options.push("hasDestroy: true");
    if (userDataIndex !== undefined) options.push(`userDataIndex: ${userDataIndex}`);
    if (owningParameter.scope !== undefined) options.push(`scope: ${sourceStringLiteral(owningParameter.scope)}`);
    return options.length > 0 ? `{ ${options.join(", ")} }` : undefined;
};

const renderCallbackType = (
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

    const returnRef = callback.returnValue.type;

    const returnType = isVoidRef(context.library, returnRef)
        ? tVoid
        : renderDescriptor(context, returnRef, callback.returnValue.transferOwnership);

    const optionsArg = callbackOptionsArg(owningParameter, findUserDataIndex(callback.parameters));
    return tCallback(argTypes, returnType, optionsArg);
};

const primitiveExpression = (category: PrimitiveCategory, ownership: Ownership): string => {
    if (category === "void") return tVoid;
    if (category === "string") return tString(ownership);
    if (category === "pointer") return tUint64;
    if (category === "gtype") return tGtype;
    return tScalar(category satisfies ScalarDescriptorName);
};

const renderFundamental = (descriptor: FundamentalDescriptor): string => {
    const { lib, refFunc, unrefFunc, typeName, ownership, wrapperClass } = descriptor;

    return tFundamental(lib, refFunc, unrefFunc, {
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

const isClassOrInterface = (type: GirType | undefined): type is Extract<EntityType, { kind: "class" | "interface" }> =>
    type !== undefined && (type.kind === "class" || type.kind === "interface");

const fundamentalOf = (node: Extract<EntityType, { kind: "class" | "interface" }>): AncestorFundamental | undefined => {
    const cls = node.value;
    if (!cls.fundamental || cls.glibRefFunc === undefined || cls.glibUnrefFunc === undefined) return undefined;

    return {
        lib: node.namespace.sharedLibrary ?? "",
        refFunc: cls.glibRefFunc,
        unrefFunc: cls.glibUnrefFunc,
        typeName: cls.glibTypeName,
    };
};

const walkFundamental = (
    context: ModuleContext,
    current: GirType | undefined,
    seen: Set<string>,
): AncestorFundamental | undefined => {
    if (!isClassOrInterface(current)) return undefined;
    const key = `${current.namespace.name}.${current.value.name}`;
    if (seen.has(key)) return undefined;
    seen.add(key);
    const fundamental = fundamentalOf(current);
    if (fundamental !== undefined) return fundamental;
    if (current.value.parent === undefined) return undefined;
    const parent = context.library.resolveType(current.namespace.name, current.value.parent);
    return walkFundamental(context, parent, seen);
};

const fundamentalAncestor = (
    context: ModuleContext,
    start: Extract<EntityType, { kind: "class" | "interface" }>,
): AncestorFundamental | undefined => walkFundamental(context, start, new Set<string>());

const classSelfDescriptor = (
    context: ModuleContext,
    type: Extract<EntityType, { kind: "class" | "interface" }>,
): string => {
    const ancestor = fundamentalAncestor(context, type);
    return ancestor === undefined ? tObject("borrowed") : renderFundamental({ ...ancestor, ownership: "borrowed" });
};

const renderSelfDescriptor = (context: ModuleContext, instance: GirParameter): string => {
    const ref = instance.type;
    if (ref === undefined) return tObject("borrowed");
    const type = context.library.typeOf(ref);
    if (type === undefined) return tObject("borrowed");
    if (isClassOrInterface(type)) return classSelfDescriptor(context, type);
    if (type.kind === "record") return recordExpression(context, type, transferOwnership(instance.transferOwnership));
    return tObject("borrowed");
};

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

const fundamentalRecordExpression = (options: FundamentalRecordOptions): string => {
    const { resolved, refFunc, unrefFunc, ownership, wrapperClass } = options;

    return renderFundamental({
        lib: resolved.namespace.sharedLibrary ?? "",
        refFunc,
        unrefFunc,
        typeName: resolved.value.glibTypeName,
        ownership,
        wrapperClass,
    });
};

const boxedRecordExpression = (options: {
    context: ModuleContext;
    resolved: Extract<EntityType, { kind: "record" }>;
    ownership: Ownership;
    callerAllocated: boolean;
    typeFnName: string;
}): string => {
    const { context, resolved, ownership, callerAllocated, typeFnName } = options;
    const record = resolved.value;
    const glibName = record.glibTypeName ?? record.cType ?? record.name;
    const { size } = computeRecordFieldSlots(context, record.fields, record.isUnion);

    return tBoxed(glibName, {
        ownership,
        sharedLibrary: resolved.namespace.sharedLibrary,
        getTypeFnName: typeFnName,
        callerAllocated,
        size: size > 0 ? size : undefined,
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
        return fundamentalRecordExpression({ resolved, refFunc, unrefFunc, ownership, wrapperClass });
    }

    if (record.glibGetType === undefined) {
        return structExpression(context, resolved, ownership, callerAllocated);
    }

    return boxedRecordExpression({
        context,
        resolved,
        ownership,
        callerAllocated,
        typeFnName: record.glibGetType,
    });
};

const rawEnumDescriptor = (signed: boolean): string => (signed ? tInt32 : tUint32);

const enumExpression = (resolved: Extract<EntityType, { kind: "enum" }>): string => {
    const getter = resolved.value.glibGetType;
    const signed = resolved.value.members.some((member) => member.value.startsWith("-"));
    if (getter === undefined || getter === "") return rawEnumDescriptor(signed);
    const lib = resolved.namespace.sharedLibrary ?? "";
    return resolved.value.kind === "bitfield" ? tFlags(lib, getter, signed) : tEnum(lib, getter, signed);
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
        case "interface": {
            return classOrInterfaceExpression(resolved, ownership);
        }
        case "record": {
            return recordExpression(context, resolved, ownership, options.callerAllocated ?? false);
        }
        case "enum": {
            return enumExpression(resolved);
        }
        case "alias": {
            return aliasExpression(context, resolved.value.target, transfer, options);
        }
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

const recordInlineSize = (context: ModuleContext, record: ResolvedRecord): number | undefined => {
    if (record.opaque || record.disguised || record.fields.length === 0) return undefined;
    const { size } = computeRecordFieldSlots(context, record.fields, record.isUnion);
    return size > 0 ? size : undefined;
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
    return recordInlineSize(context, type.value);
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

export {
    isInlineCallbackRef,
    omitsPrimaryReturn,
    renderDescriptor,
    isScalarRef,
    isCellInout,
    renderParamDescriptor,
    renderCallbackType,
    renderSelfDescriptor,
};
