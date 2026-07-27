import { sourceStringLiteral } from "@gtkx/utils";
import type { GirCallback } from "../gir/callback.js";
import type { Library } from "../gir/library.js";
import type { PrimitiveCategory } from "../gir/primitives.js";
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
import {
    type CArrayType,
    hasUnknownArrayLength,
    type ListFlavor,
    type ListType,
    type TypeId,
} from "../gir/type-id.js";
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
    /** GIR parameter index to emitted argument index, for callables that drop parameters. */
    argIndexMap?: Map<number, number> | undefined;
    callerAllocated?: boolean;
    isInline?: boolean;
};

type ArgIndexOptions = {
    argIndexOffset: number;
    argIndexMap: Map<number, number> | undefined;
};

type RecordPlacement = {
    isCallerAllocated?: boolean;
    isInline?: boolean;
};

type FundamentalDescriptor = {
    lib: string;
    refFunc: string;
    unrefFunc: string;
    typeName: string | undefined;
    ownership: Ownership;
    wrapperClass?: string | undefined;
    inline?: boolean | undefined;
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
    inline: boolean;
};

const LIST_HELPERS: Record<Exclude<ListFlavor, "gbytearray">, ListDescriptorName> = {
    glist: "list",
    gslist: "slist",
    gptrarray: "ptrArray",
    garray: "gArray",
};

// A callable that drops parameters (varargs, and the closure/destroy slots folded into a callback)
// shifts every later parameter left, so a GIR length index has to be looked up in the emitted list
// rather than shifted by the instance offset alone.
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

const isVoidRef = (library: Library, ref: TypeId | undefined): boolean => {
    if (ref === undefined) {
        return true;
    }

    const type = library.typeFor(ref);

    return type?.kind === "primitive" && type.category === "void";
};

const isInlineCallbackRef = (library: Library, ref: TypeId | undefined): boolean =>
    ref !== undefined && library.typeFor(ref)?.kind === "callback" && library.nameFor(ref) === undefined;

const shouldOmitPrimaryReturn = (library: Library, returnValue: GirReturnValue): boolean =>
    isVoidRef(library, returnValue.type) || returnValue.skip;

const renderDescriptor = (
    context: ModuleContext,
    ref: TypeId | undefined,
    transfer: ParameterTransfer = "none",
    options: RenderDescriptorOptions = {},
): string => {
    if (ref === undefined) {
        return tVoid;
    }

    const { argIndexOffset = 0 } = options;
    const indexOptions: ArgIndexOptions = { argIndexOffset, argIndexMap: options.argIndexMap };
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
        // A callback in a slot no `renderCallbackType` covers (a vtable entry, a signal argument, a
        // record field) is still a function pointer occupying a pointer-sized slot. `t.void` would
        // hand the implementation `undefined` where the pointer belongs.
        case "callback": {
            return tUint64;
        }
        case "class":
        case "interface":
        case "record":
        case "enum":
        case "alias": {
            return expressionForResolved(context, type, transfer, options);
        }
        case "carray": {
            return arrayExpression(context, type, transfer, indexOptions);
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

const isCellInout = (library: Library, parameter: GirParameter): boolean =>
    isInoutParameter(parameter) && isScalarRef(library, parameter.type);

const renderParamDescriptor = (
    context: ModuleContext,
    parameter: GirParameter,
    ref: TypeId | undefined,
    argIndex: Partial<ArgIndexOptions> = {},
): string => {
    if (isCellInout(context.library, parameter)) {
        return tRef(renderDescriptor(context, ref, parameter.transferOwnership, argIndex), true);
    }

    if (isOutParameter(parameter)) {
        return tRef(renderDescriptor(context, ref, parameter.transferOwnership, argIndex));
    }

    return renderDescriptor(context, ref, parameter.transferOwnership, {
        ...argIndex,
        callerAllocated: isCallerAllocatedOut(parameter) || isRecordInout(context, parameter),
    });
};

// `closure=` on a callback's own parameter states which slot carries the user data, and it is what
// the TypeScript signature already goes by. The name scan stays as a fallback: 88 callbacks across
// the installed GIRs carry no `closure=` at all.
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

const callbackOptionsArg = (owningParameter: GirParameter, userDataIndex: number | undefined): string | undefined => {
    const options: string[] = [];

    if (owningParameter.destroyIndex !== undefined) {
        options.push("hasDestroy: true");
    }

    if (userDataIndex !== undefined) {
        options.push(`userDataIndex: ${String(userDataIndex)}`);
    }

    if (owningParameter.scope !== undefined) {
        options.push(`scope: ${sourceStringLiteral(owningParameter.scope)}`);
    }

    return options.length > 0 ? `{ ${options.join(", ")} }` : undefined;
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

    const returnRef = callback.returnValue.type;

    const returnType = isVoidRef(context.library, returnRef)
        ? tVoid
        : renderDescriptor(context, returnRef, callback.returnValue.transferOwnership);

    const optionsArg = callbackOptionsArg(owningParameter, findUserDataIndex(callback.parameters));

    return tCallback(argTypes, returnType, optionsArg);
};

const primitiveExpression = (category: PrimitiveCategory, ownership: Ownership): string => {
    if (category === "void") {
        return tVoid;
    }

    if (category === "string") {
        return tString(ownership);
    }

    if (category === "pointer") {
        return tUint64;
    }

    if (category === "gtype") {
        return tGtype;
    }

    return tScalar(category satisfies ScalarDescriptorName);
};

const renderFundamental = (descriptor: FundamentalDescriptor): string => {
    const { lib, refFunc, unrefFunc, typeName, ownership, wrapperClass, inline } = descriptor;

    return tFundamental(lib, refFunc, unrefFunc, {
        ownership,
        typeName,
        wrapperClass,
        inline,
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

const getFundamental = (
    node: Extract<EntityType, { kind: "class" | "interface" }>,
): AncestorFundamental | undefined => {
    const cls = node.value;

    if (!cls.fundamental || cls.glibRefFunc === undefined || cls.glibUnrefFunc === undefined) {
        return undefined;
    }

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
): string => {
    const ancestor = fundamentalAncestor(context, type);

    return ancestor === undefined ? tObject("borrowed") : renderFundamental({ ...ancestor, ownership: "borrowed" });
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
        return classSelfDescriptor(context, type);
    }

    if (type.kind === "record") {
        return recordExpression(context, type, transferOwnership(instance.transferOwnership));
    }

    return tObject("borrowed");
};

// A record expresses its acquire/release pair as `copy-function`/`free-function`: no `<record>` in
// any installed GIR carries `glib:ref-func`, and GVariant's copy function really is
// `g_variant_ref_sink`.
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
    options: { callerAllocated: boolean; inline: boolean },
): string => {
    const { size } = computeRecordFieldSlots(context, resolved.value.fields, resolved.value.isUnion);
    const wrapperClass = context.qualify(resolved.namespace.name, resolved.value.name);

    return tStruct(ownership, {
        size: size > 0 ? size : undefined,
        wrapperClass,
        callerAllocated: options.callerAllocated,
        inline: options.inline,
    });
};

const fundamentalRecordExpression = (options: FundamentalRecordOptions): string => {
    const { resolved, refFunc, unrefFunc, ownership, wrapperClass, inline } = options;

    return renderFundamental({
        lib: resolved.namespace.sharedLibrary ?? "",
        refFunc,
        unrefFunc,
        typeName: resolved.value.glibTypeName,
        ownership,
        wrapperClass,
        inline,
    });
};

const boxedRecordExpression = (options: {
    context: ModuleContext;
    resolved: Extract<EntityType, { kind: "record" }>;
    ownership: Ownership;
    callerAllocated: boolean;
    inline: boolean;
    typeFnName: string;
}): string => {
    const { context, resolved, ownership, callerAllocated, inline, typeFnName } = options;
    const record = resolved.value;
    const glibName = record.glibTypeName ?? record.cType ?? record.name;
    const { size } = computeRecordFieldSlots(context, record.fields, record.isUnion);

    return tBoxed(glibName, {
        ownership,
        sharedLibrary: resolved.namespace.sharedLibrary,
        getTypeFnName: typeFnName,
        callerAllocated,
        inline,
        size: size > 0 ? size : undefined,
    });
};

const plainRecordExpression = (
    context: ModuleContext,
    resolved: Extract<EntityType, { kind: "record" }>,
    ownership: Ownership,
    placement: RecordPlacement,
): string => {
    const record = resolved.value;

    const layout = {
        callerAllocated: placement.isCallerAllocated ?? false,
        inline: placement.isInline ?? false,
    };

    if (record.glibGetType === undefined) {
        return structExpression(context, resolved, ownership, layout);
    }

    return boxedRecordExpression({ context, resolved, ownership, ...layout, typeFnName: record.glibGetType });
};

const recordExpression = (
    context: ModuleContext,
    resolved: Extract<EntityType, { kind: "record" }>,
    ownership: Ownership,
    placement: RecordPlacement = {},
): string => {
    const record = resolved.value;
    const { refFunc, unrefFunc } = recordRefPair(record);

    if (refFunc !== undefined && unrefFunc !== undefined) {
        const wrapperClass = requiresFallbackClass(record)
            ? context.qualify(resolved.namespace.name, record.name)
            : undefined;

        return fundamentalRecordExpression({
            resolved,
            refFunc,
            unrefFunc,
            ownership,
            wrapperClass,
            inline: placement.isInline ?? false,
        });
    }

    return plainRecordExpression(context, resolved, ownership, placement);
};

const rawEnumDescriptor = (isSigned: boolean): string => (isSigned ? tInt32 : tUint32);

const enumExpression = (resolved: Extract<EntityType, { kind: "enum" }>): string => {
    const getter = resolved.value.glibGetType;
    const isSigned = resolved.value.members.some((member) => member.value.startsWith("-"));

    if (getter === undefined || getter === "") {
        return rawEnumDescriptor(isSigned);
    }

    const lib = resolved.namespace.sharedLibrary ?? "";

    return resolved.value.kind === "bitfield" ? tFlags(lib, getter, isSigned) : tEnum(lib, getter, isSigned);
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
            return recordExpression(context, resolved, ownership, {
                isCallerAllocated: options.callerAllocated ?? false,
                isInline: options.isInline ?? false,
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

const arrayExpression = (
    context: ModuleContext,
    ref: CArrayType,
    transfer: ParameterTransfer,
    options: ArgIndexOptions,
): string => {
    if (hasUnknownArrayLength(ref)) {
        return tUint64;
    }

    const ownership = transferOwnership(transfer);
    const element = renderDescriptor(context, ref.element, deriveElementTransfer(transfer), options);
    const size = inlineElementSize(context, ref.element, ref.elementCType);

    if (ref.lengthParameterIndex !== undefined) {
        return tSizedArray(element, mapArgIndex(options, ref.lengthParameterIndex), ownership, size);
    }

    if (ref.fixedSize !== undefined) {
        return tFixedArray(element, ref.fixedSize, ownership, size);
    }

    return tArray(element, ownership, size);
};

const recordInlineSize = (context: ModuleContext, record: ResolvedRecord): number | undefined => {
    if (record.opaque || record.disguised || record.fields.length === 0) {
        return undefined;
    }

    const { size } = computeRecordFieldSlots(context, record.fields, record.isUnion);

    return size > 0 ? size : undefined;
};

const inlineElementSize = (
    context: ModuleContext,
    element: TypeId | undefined,
    elementCType: string | undefined,
): number | undefined => {
    if (element === undefined) {
        return undefined;
    }

    if (elementCType?.includes("*")) {
        return undefined;
    }

    const type = context.library.typeFor(element);

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
    isInlineCallbackRef,
    shouldOmitPrimaryReturn,
    renderDescriptor,
    isScalarRef,
    isCellInout,
    renderParamDescriptor,
    renderCallbackType,
    renderSelfDescriptor,
};
