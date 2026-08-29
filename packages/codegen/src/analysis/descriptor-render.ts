import { sanitizeTypeIdentifier, sourceStringLiteral } from "@gtkx/utils";
import type { GirCallback } from "../gir/callback.js";
import type { Library } from "../gir/library.js";
import type { PrimitiveCategory } from "../gir/primitives.js";
import type { EntityType, GirType } from "../gir/type.js";
import type { ModuleContext } from "../writer/context.js";
import {
    type GirCursorBounds,
    type GirParameter,
    type GirReturnValue,
    isCallerAllocatedOut,
    isInoutParameter,
    isOutParameter,
    type ParameterTransfer,
} from "../gir/parameter.js";
import {
    type CArrayType,
    hasUnknownArrayLength,
    type ListFlavor,
    type ListType,
    type TypeId,
} from "../gir/type-id.js";
import { isRecordInout } from "../store/gi/param-marshal.js";
import { computeRecordFieldSlots, recordInlineSize } from "../store/gi/record-layout.js";
import { isValueMarshalable } from "../store/gi/value-marshalable.js";
import {
    type ArrayLayout,
    type ListDescriptorName,
    type Ownership,
    type ScalarDescriptorName,
    tArray,
    tBiguint64,
    tBoxed,
    tByteArray,
    tCallback,
    tCursorArray,
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
import { carrayFor, isByteSequence, isUnboundedArray, primitiveCategoryFor } from "./type-shape.js";

type PrimaryReturnKind = "surfaced" | "void" | "skipped";

type ArgIndexOptions = {
    argIndexOffset: number;
    argIndexMap: Map<number, number> | undefined;
    cursor: GirCursorBounds | undefined;
    hasOutIndirection: boolean;
    isReceived: boolean;
};

type CursorArgIndexOptions = ArgIndexOptions & { cursor: GirCursorBounds };
type CArrayExpressionOptions = ArgIndexOptions & { isCallerAllocated: boolean };

type RenderDescriptorOptions = Partial<ArgIndexOptions> & {
    isCallerAllocated?: boolean;
    isInline?: boolean;
    isNewlyCreated?: boolean;
};

type RecordPlacement = {
    isCallerAllocated?: boolean;
    isInline?: boolean;
    isReceived?: boolean;
};

type RecordLayout = {
    isCallerAllocated: boolean;
    isInline: boolean;
    isReceived: boolean;
};

type FundamentalDescriptor = {
    lib: string;
    refFunc: string;
    unrefFunc: string;
    typeName: string | undefined;
    ownership: Ownership;
    wrapperClass?: string | undefined;
    fallbackClass?: string | undefined;
    isCallerAllocated?: boolean | undefined;
    isInline?: boolean | undefined;
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
    lib: string;
    refFunc: string;
    unrefFunc: string;
    ownership: Ownership;
    wrapperClass: string | undefined;
    fallbackClass?: string | undefined;
    isCallerAllocated: boolean;
    isInline: boolean;
};

const LIST_HELPERS: Record<Exclude<ListFlavor, "gbytearray">, ListDescriptorName> = {
    glist: "list",
    gslist: "slist",
    gptrarray: "ptrArray",
    garray: "gArray",
};

const FLOATING_FUNDAMENTALS: Set<string> = new Set(["GParam"]);

const mapArgIndex = (options: ArgIndexOptions, girIndex: number): number =>
    options.argIndexMap?.get(girIndex) ?? girIndex + options.argIndexOffset;

const transferOwnership = (transfer: ParameterTransfer): Ownership => {
    if (transfer === "full") {
        return "full";
    }

    if (transfer === "container") {
        return "full";
    }

    return "borrowed";
};

const deriveElementTransfer = (transfer: ParameterTransfer): ParameterTransfer =>
    transfer === "container" ? "none" : transfer;

const isVoidRef = (library: Library, ref: TypeId | undefined): boolean =>
    ref === undefined || primitiveCategoryFor(library, ref) === "void";

const isInlineCallbackRef = (library: Library, ref: TypeId | undefined): boolean =>
    ref !== undefined && library.typeFor(ref)?.kind === "callback" && library.nameFor(ref) === undefined;

const primaryReturnKind = (library: Library, returnValue: GirReturnValue): PrimaryReturnKind => {
    if (isVoidRef(library, returnValue.type)) {
        return "void";
    }

    return returnValue.skip ? "skipped" : "surfaced";
};

const shouldOmitPrimaryReturn = (library: Library, returnValue: GirReturnValue): boolean =>
    primaryReturnKind(library, returnValue) !== "surfaced";

const isSkippedPrimaryReturn = (library: Library, returnValue: GirReturnValue): boolean =>
    primaryReturnKind(library, returnValue) === "skipped";

const isVoidPrimaryReturn = (library: Library, returnValue: GirReturnValue): boolean =>
    primaryReturnKind(library, returnValue) === "void";

const argIndexOptions = (options: RenderDescriptorOptions): ArgIndexOptions => ({
    argIndexOffset: options.argIndexOffset ?? 0,
    argIndexMap: options.argIndexMap,
    cursor: options.cursor,
    hasOutIndirection: options.hasOutIndirection === true,
    isReceived: options.isReceived === true,
});

const renderDescriptor = (
    context: ModuleContext,
    ref: TypeId | undefined,
    transfer: ParameterTransfer = "none",
    options: RenderDescriptorOptions = {},
): string => {
    if (ref === undefined) {
        return tVoid;
    }

    const indexOptions = argIndexOptions(options);
    const ownership = transferOwnership(transfer);
    const type = context.library.typeFor(ref);

    if (type === undefined) {
        return tObject(ownership);
    }

    switch (type.kind) {
        case "primitive": {
            return primitiveExpression(type.category, ownership);
        }
        case "varargs": {
            return tVoid;
        }
        case "callback": {
            return tBiguint64;
        }
        case "class":
        case "interface":
        case "record":
        case "enum":
        case "alias": {
            return expressionForResolved(context, type, transfer, options);
        }
        case "carray": {
            return arrayExpression(context, type, transfer, {
                ...indexOptions,
                isCallerAllocated: options.isCallerAllocated === true,
            });
        }
        case "list": {
            return listExpression(context, type, transfer, indexOptions);
        }
        case "hashtable": {
            const elementTransfer = deriveElementTransfer(transfer);
            const key = renderDescriptor(context, type.key, elementTransfer, indexOptions);
            const value = renderDescriptor(context, type.value, elementTransfer, indexOptions);

            return tHashTable(key, value, ownership);
        }
    }
};

const listExpression = (
    context: ModuleContext,
    type: ListType,
    transfer: ParameterTransfer,
    indexOptions: ArgIndexOptions,
): string => {
    const ownership = transferOwnership(transfer);

    if (type.flavor === "gbytearray") {
        return tByteArray(ownership);
    }

    const element = renderDescriptor(context, type.element, deriveElementTransfer(transfer), indexOptions);

    return tList(LIST_HELPERS[type.flavor], element, ownership);
};

const resolveCallbackType = (context: ModuleContext, ref: TypeId | undefined): GirCallback | undefined => {
    if (ref === undefined) {
        return undefined;
    }

    const type = context.library.typeFor(ref);

    if (type?.kind !== "callback") {
        return undefined;
    }

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
        case "callback":
        case "carray":
        case "class":
        case "hashtable":
        case "interface":
        case "list":
        case "record":
        case "varargs": {
            return false;
        }
    }
};

const isScalarRef = (library: Library, ref: TypeId | undefined): boolean => {
    if (ref === undefined) {
        return false;
    }

    const type = library.typeFor(ref);

    return type !== undefined && isScalarType(library, type);
};

const isStrvRef = (library: Library, ref: TypeId | undefined): boolean => {
    const type = carrayFor(library, ref);

    if (type === undefined) {
        return false;
    }

    return isUnboundedArray(type) && primitiveCategoryFor(library, type.element) === "string";
};

const isCellInout = (library: Library, parameter: GirParameter): boolean =>
    isInoutParameter(parameter) &&
    (isScalarRef(library, parameter.type) || isStrvRef(library, parameter.type));

const renderParamDescriptor = (
    context: ModuleContext,
    parameter: GirParameter,
    ref: TypeId | undefined,
    argIndex: Partial<ArgIndexOptions> = {},
): string => {
    const behindRef: RenderDescriptorOptions = {
        ...argIndex,
        cursor: parameter.cursor,
        hasOutIndirection: true,
        isReceived: true,
    };

    if (isCellInout(context.library, parameter)) {
        return tRef(renderDescriptor(context, ref, parameter.transferOwnership, behindRef), true);
    }

    if (isOutParameter(parameter)) {
        return tRef(renderDescriptor(context, ref, parameter.transferOwnership, behindRef));
    }

    return renderDescriptor(context, ref, parameter.transferOwnership, {
        ...argIndex,
        isCallerAllocated: isCallerAllocatedOut(parameter) || isRecordInout(context, parameter),
        isReceived: true,
    });
};

const userDataIndexByName = (parameters: GirParameter[]): number | undefined => {
    let userDataIndex: number | undefined;

    for (const [index, parameter] of parameters.entries()) {
        if (parameter.name === "user_data" || parameter.name === "data") {
            userDataIndex = index;
        }
    }

    return userDataIndex;
};

const findUserDataIndex = (parameters: GirParameter[]): number | undefined => {
    const declared = parameters.find((parameter) => parameter.closureIndex !== undefined);

    return declared?.closureIndex ?? userDataIndexByName(parameters);
};

const callbackOptionsArg = (
    owningParameter: GirParameter,
    userDataIndex: number | undefined,
    canThrow: boolean,
): string[] => {
    const options: string[] = [];

    if (owningParameter.destroyIndex !== undefined) {
        options.push("hasDestroy: true");
    }

    if (owningParameter.closureIndex !== undefined) {
        options.push("hasUserData: true");
    }

    if (userDataIndex !== undefined) {
        options.push(`userDataIndex: ${String(userDataIndex)}`);
    }

    if (canThrow) {
        options.push("canThrow: true");
    }

    if (owningParameter.scope !== undefined) {
        options.push(`scope: ${sourceStringLiteral(owningParameter.scope)}`);
    }

    return options;
};

const renderCallbackType = (
    context: ModuleContext,
    ref: TypeId | undefined,
    owningParameter: GirParameter,
    argOverrides?: Map<number, string>,
): string | undefined => {
    const callback = resolveCallbackType(context, ref);

    if (callback === undefined) {
        return undefined;
    }

    const argTypes = callback.parameters.map(
        (parameter, index) => argOverrides?.get(index) ?? renderParamDescriptor(context, parameter, parameter.type),
    );

    const { returnValue } = callback;

    return tCallback({
        argTypes,
        returns: renderDescriptor(context, returnValue.type, returnValue.transferOwnership, { isReceived: true }),
        options: callbackOptionsArg(owningParameter, findUserDataIndex(callback.parameters), callback.throws),
    });
};

const primitiveExpression = (category: PrimitiveCategory, ownership: Ownership): string => {
    if (category === "void") {
        return tVoid;
    }

    if (category === "string") {
        return tString(ownership);
    }

    if (category === "pointer") {
        return tBiguint64;
    }

    if (category === "gtype") {
        return tGtype;
    }

    return tScalar(category satisfies ScalarDescriptorName);
};

const renderFundamental = (descriptor: FundamentalDescriptor): string => {
    const { lib, refFunc, unrefFunc, typeName, ownership, wrapperClass, fallbackClass } = descriptor;

    return tFundamental(lib, refFunc, unrefFunc, {
        ownership,
        typeName,
        wrapperClass,
        fallbackClass,
        isCallerAllocated: descriptor.isCallerAllocated,
        isInline: descriptor.isInline,
    });
};

const fallbackClassThunk = (
    context: ModuleContext,
    namespaceName: string,
    name: string,
    isReceived: boolean,
): string | undefined =>
    isReceived ? `() => ${context.qualify(namespaceName, sanitizeTypeIdentifier(name))}` : undefined;

const sunkOwnership = (
    ancestor: AncestorFundamental,
    ownership: Ownership,
    isNewlyCreated: boolean,
): Ownership => {
    if (!isNewlyCreated || ownership !== "full" || ancestor.typeName === undefined) {
        return ownership;
    }

    return FLOATING_FUNDAMENTALS.has(ancestor.typeName) ? "borrowed" : ownership;
};

const classOrInterfaceExpression = (
    context: ModuleContext,
    resolved: Extract<EntityType, { kind: "class" | "interface" }>,
    ownership: Ownership,
    options: { isNewlyCreated: boolean; isReceived: boolean },
): string => {
    const ancestor = fundamentalAncestor(context, resolved);
    const fallbackClass = fallbackClassThunk(context, resolved.namespace.name, resolved.value.name, options.isReceived);

    if (ancestor === undefined) {
        return tObject(ownership, fallbackClass);
    }

    return renderFundamental({
        ...ancestor,
        ownership: sunkOwnership(ancestor, ownership, options.isNewlyCreated),
        fallbackClass,
    });
};

const isClassOrInterface = (type: GirType | undefined): type is Extract<EntityType, { kind: "class" | "interface" }> =>
    type !== undefined && (type.kind === "class" || type.kind === "interface");

const getFundamental = (
    node: Extract<EntityType, { kind: "class" | "interface" }>,
): AncestorFundamental | undefined => {
    const cls = node.value;
    const lib = node.namespace.sharedLibrary;

    if (lib === undefined || !cls.fundamental || cls.glibRefFunc === undefined || cls.glibUnrefFunc === undefined) {
        return undefined;
    }

    return {
        lib,
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
    if (!isClassOrInterface(current)) {
        return undefined;
    }

    const key = `${current.namespace.name}.${current.value.name}`;

    if (seen.has(key)) {
        return undefined;
    }

    seen.add(key);
    const fundamental = getFundamental(current);

    if (fundamental !== undefined) {
        return fundamental;
    }

    if (current.value.parent === undefined) {
        return undefined;
    }

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
    ownership: Ownership,
): string => {
    const ancestor = fundamentalAncestor(context, type);

    return ancestor === undefined ? tObject(ownership) : renderFundamental({ ...ancestor, ownership });
};

const renderSelfDescriptor = (context: ModuleContext, instance: GirParameter): string => {
    const ref = instance.type;

    if (ref === undefined) {
        return tObject("borrowed");
    }

    const type = context.library.typeFor(ref);

    if (type === undefined) {
        return tObject("borrowed");
    }

    if (isClassOrInterface(type)) {
        return classSelfDescriptor(context, type, transferOwnership(instance.transferOwnership));
    }

    if (type.kind === "record") {
        return recordExpression(context, type, transferOwnership(instance.transferOwnership));
    }

    return tObject("borrowed");
};

const recordLayout = (placement: RecordPlacement): RecordLayout => ({
    isCallerAllocated: placement.isCallerAllocated ?? false,
    isInline: placement.isInline ?? false,
    isReceived: placement.isReceived === true,
});

const recordRefPair = (record: ResolvedRecord): { refFunc: string | undefined; unrefFunc: string | undefined } => ({
    refFunc: record.glibRefFunc ?? record.copyFunc,
    unrefFunc: record.glibUnrefFunc ?? record.freeFunc,
});

const requiresFallbackClass = (record: ResolvedRecord): boolean => {
    const { refFunc, unrefFunc } = recordRefPair(record);

    if (refFunc !== undefined && unrefFunc !== undefined) {
        return record.glibTypeName === undefined;
    }

    return record.glibGetType === undefined;
};

const structExpression = (
    context: ModuleContext,
    resolved: Extract<EntityType, { kind: "record" }>,
    ownership: Ownership,
    options: { isCallerAllocated: boolean; isInline: boolean },
): string => {
    const { size } = computeRecordFieldSlots(context, resolved.value.fields, resolved.value.isUnion);
    const wrapperClass = context.qualify(resolved.namespace.name, sanitizeTypeIdentifier(resolved.value.name));
    const isCopyable = isValueMarshalable(context, resolved.namespace.name, resolved.value);

    return tStruct(ownership, {
        size: isCopyable && size > 0 ? size : undefined,
        wrapperClass,
        isCallerAllocated: options.isCallerAllocated,
        isInline: options.isInline,
    });
};

const fundamentalRecordExpression = (options: FundamentalRecordOptions): string => {
    const { resolved, lib, refFunc, unrefFunc, ownership, wrapperClass, fallbackClass } = options;

    return renderFundamental({
        lib,
        refFunc,
        unrefFunc,
        typeName: resolved.value.glibTypeName,
        ownership,
        wrapperClass,
        fallbackClass,
        isCallerAllocated: options.isCallerAllocated,
        isInline: options.isInline,
    });
};

const boxedRecordExpression = (options: {
    context: ModuleContext;
    resolved: Extract<EntityType, { kind: "record" }>;
    ownership: Ownership;
    isCallerAllocated: boolean;
    isInline: boolean;
    isReceived: boolean;
    typeFnName: string;
}): string => {
    const { context, resolved, ownership, isCallerAllocated, isInline, typeFnName } = options;
    const record = resolved.value;
    const glibName = record.glibTypeName ?? record.cType ?? record.name;
    const { size } = computeRecordFieldSlots(context, record.fields, record.isUnion);

    return tBoxed(glibName, {
        ownership,
        sharedLibrary: resolved.namespace.sharedLibrary,
        getTypeFnName: typeFnName,
        freeFnName: record.freeFunc,
        isCallerAllocated,
        isInline,
        size: size > 0 ? size : undefined,
        fallbackClass: fallbackClassThunk(context, resolved.namespace.name, record.name, options.isReceived),
    });
};

const plainRecordExpression = (
    context: ModuleContext,
    resolved: Extract<EntityType, { kind: "record" }>,
    ownership: Ownership,
    placement: RecordPlacement,
): string => {
    const record = resolved.value;
    const layout = recordLayout(placement);

    if (record.glibGetType === undefined) {
        return structExpression(context, resolved, ownership, layout);
    }

    return boxedRecordExpression({ context, resolved, ownership, ...layout, typeFnName: record.glibGetType });
};

const isPlainStruct = (resolved: Extract<EntityType, { kind: "record" }>): boolean => {
    const record = resolved.value;
    const { refFunc, unrefFunc } = recordRefPair(record);

    if (refFunc !== undefined && unrefFunc !== undefined && resolved.namespace.sharedLibrary !== undefined) {
        return false;
    }

    return record.glibGetType === undefined;
};

const fundamentalRecordPath = (
    context: ModuleContext,
    resolved: Extract<EntityType, { kind: "record" }>,
    ownership: Ownership,
    placement: RecordPlacement,
): string | undefined => {
    const record = resolved.value;
    const { refFunc, unrefFunc } = recordRefPair(record);
    const lib = resolved.namespace.sharedLibrary;

    if (refFunc === undefined || unrefFunc === undefined || lib === undefined) {
        return undefined;
    }

    const wrapperClass = requiresFallbackClass(record)
        ? context.qualify(resolved.namespace.name, sanitizeTypeIdentifier(record.name))
        : undefined;

    return fundamentalRecordExpression({
        resolved,
        lib,
        refFunc,
        unrefFunc,
        ownership,
        wrapperClass,
        fallbackClass:
            wrapperClass === undefined
                ? fallbackClassThunk(context, resolved.namespace.name, record.name, placement.isReceived === true)
                : undefined,
        ...recordLayout(placement),
    });
};

const recordExpression = (
    context: ModuleContext,
    resolved: Extract<EntityType, { kind: "record" }>,
    ownership: Ownership,
    placement: RecordPlacement = {},
): string =>
    fundamentalRecordPath(context, resolved, ownership, placement) ??
    plainRecordExpression(context, resolved, ownership, placement);

const rawEnumDescriptor = (isSigned: boolean): string => (isSigned ? tInt32 : tUint32);

const flagsMask = (resolved: Extract<EntityType, { kind: "enum" }>): number =>
    resolved.value.members.reduce((mask, member) => (mask | Number(member.value)) >>> 0, 0);

const enumExpression = (resolved: Extract<EntityType, { kind: "enum" }>): string => {
    const getter = resolved.value.glibGetType;
    const isSigned = resolved.value.members.some((member) => member.value.startsWith("-"));
    const lib = resolved.namespace.sharedLibrary;
    const isBitfield = resolved.value.kind === "bitfield";

    if (getter === undefined || getter === "" || lib === undefined) {
        return isBitfield ? tFlags("", "", isSigned, flagsMask(resolved)) : rawEnumDescriptor(isSigned);
    }

    return isBitfield ? tFlags(lib, getter, isSigned) : tEnum(lib, getter, isSigned);
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
            return classOrInterfaceExpression(context, resolved, ownership, {
                isNewlyCreated: options.isNewlyCreated ?? false,
                isReceived: options.isReceived === true,
            });
        }
        case "record": {
            return recordExpression(context, resolved, ownership, {
                isCallerAllocated: options.isCallerAllocated ?? false,
                isInline: options.isInline ?? false,
                isReceived: options.isReceived === true,
            });
        }
        case "enum": {
            return enumExpression(resolved);
        }
        case "alias": {
            return aliasExpression(context, resolved.value.target, transfer, options);
        }
    }
};

const elementExpression = (
    context: ModuleContext,
    ref: CArrayType,
    transfer: ParameterTransfer,
    options: ArgIndexOptions,
): string =>
    renderDescriptor(context, ref.element, deriveElementTransfer(transfer), {
        ...options,
        cursor: undefined,
        hasOutIndirection: false,
        isCallerAllocated: false,
    });

const cursorArrayExpression = (
    context: ModuleContext,
    ref: CArrayType,
    transfer: ParameterTransfer,
    options: CursorArgIndexOptions & { layout: ArrayLayout },
): string =>
    tCursorArray(
        elementExpression(context, ref, transfer, options),
        {
            baseIndex: mapArgIndex(options, options.cursor.baseIndex),
            lengthIndex: mapArgIndex(options, options.cursor.lengthIndex),
        },
        transferOwnership(transfer),
        options.layout,
    );

const arrayLayout = (context: ModuleContext, ref: CArrayType, options: ArgIndexOptions): ArrayLayout => ({
    elementSize: inlineElementSize(context, ref, options.hasOutIndirection),
    isBytes: !hasUnknownArrayLength(ref) && isByteSequence(context.library, ref),
});

const fixedArrayLayout = (layout: ArrayLayout, isCallerAllocated: boolean): ArrayLayout =>
    isCallerAllocated ? { ...layout, isCallerAllocated: true } : layout;

const arrayExpression = (
    context: ModuleContext,
    ref: CArrayType,
    transfer: ParameterTransfer,
    options: CArrayExpressionOptions,
): string => {
    const { cursor } = options;
    const layout = arrayLayout(context, ref, options);

    if (cursor !== undefined) {
        return cursorArrayExpression(context, ref, transfer, { ...options, cursor, layout });
    }

    if (hasUnknownArrayLength(ref)) {
        return tUint64;
    }

    const ownership = transferOwnership(transfer);
    const element = elementExpression(context, ref, transfer, options);

    if (ref.lengthParameterIndex !== undefined) {
        return tSizedArray(element, mapArgIndex(options, ref.lengthParameterIndex), ownership, layout);
    }

    if (ref.fixedSize !== undefined) {
        return tFixedArray(element, ref.fixedSize, ownership, fixedArrayLayout(layout, options.isCallerAllocated));
    }

    return tArray(element, ownership, layout);
};

const elementPointerDepth = (elementCType: string | undefined, hasOutIndirection: boolean): number => {
    const declared = elementCType === undefined ? 0 : elementCType.split("*").length - 1;

    return hasOutIndirection ? declared - 1 : declared;
};

const inlineElementSize = (context: ModuleContext, ref: CArrayType, hasOutIndirection: boolean): number | undefined => {
    if (elementPointerDepth(ref.elementCType, hasOutIndirection) > 0) {
        return undefined;
    }

    const type = context.library.typeFor(ref.element);

    if (type?.kind !== "record") {
        return undefined;
    }

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
    isPlainStruct,
    transferOwnership,
    isInlineCallbackRef,
    isSkippedPrimaryReturn,
    isVoidPrimaryReturn,
    primaryReturnKind,
    shouldOmitPrimaryReturn,
    renderDescriptor,
    isScalarRef,
    isCellInout,
    renderParamDescriptor,
    renderCallbackType,
    renderSelfDescriptor,
};
