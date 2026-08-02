import { pascalCase, sourceStringLiteral } from "@gtkx/utils";
import type { GirCallback } from "../../gir/callback.js";
import type { GirClass } from "../../gir/class.js";
import type { GirField } from "../../gir/field.js";
import type { GirParameter } from "../../gir/parameter.js";
import type { TypeId } from "../../gir/type-id.js";
import type { ModuleContext } from "../../writer/context.js";
import {
    isInlineCallbackRef,
    isScalarRef,
    renderDescriptor,
    renderParamDescriptor,
} from "../../analysis/descriptor-render.js";
import {
    handlerParameters,
    parameterIdentifier,
    renderHandlerParameters,
    renderHandlerResultType,
} from "../../analysis/param-structure.js";
import { renderTsType } from "../../analysis/ts-type.js";
import { renderJsDoc } from "../../writer/doc.js";
import { renderBlock, renderBraced } from "../../writer/emit.js";
import { computeRecordFieldSlots } from "./record-layout.js";

type VtableKind = "class" | "interface";
type VfuncMemberMode = "signature" | "implementation";

type VtableSlot = {
    key: string;
    field: GirField;
    callback: GirCallback;
    byteOffset: number;
    vtableSize: number;
};

type Vtable = {
    structName: string;
    kind: VtableKind;
    slots: VtableSlot[];
};

const PADDING_FIELD_NAME = /^(?:reserved|padding)\d*$/i;

const UNCALLABLE_SLOT_KEYS: Set<string> = new Set([
    "vfuncConstructed",
    "vfuncDispose",
    "vfuncFinalize",
    "vfuncGetProperty",
    "vfuncSetProperty",
]);

const vfuncMemberName = (fieldName: string): string => `vfunc${pascalCase(fieldName)}`;

const isPaddingField = (field: GirField): boolean =>
    field.name.startsWith("_") || PADDING_FIELD_NAME.test(field.name);

const vtableCallbackType = (context: ModuleContext, field: GirField): GirCallback | undefined => {
    if (field.type === undefined) {
        return undefined;
    }

    const type = context.library.typeFor(field.type);

    if (type?.kind !== "callback" || context.library.nameFor(field.type) !== undefined) {
        return undefined;
    }

    return type.value;
};

const vtableSlotEntry = (
    context: ModuleContext,
    field: GirField,
    claimedNames: Set<string>,
): { key: string; callback: GirCallback } | undefined => {
    if (field.name === "constructor" || isPaddingField(field)) {
        return undefined;
    }

    const callback = vtableCallbackType(context, field);

    if (callback === undefined) {
        return undefined;
    }

    const key = vfuncMemberName(field.name);

    if (claimedNames.has(key)) {
        return undefined;
    }

    if (!isVtableSlotEligible(context, callback)) {
        return undefined;
    }

    return { key, callback };
};

const collectVtableSlots = (context: ModuleContext, fields: GirField[], isUnion: boolean): VtableSlot[] => {
    const { slots, size } = computeRecordFieldSlots(context, fields, isUnion);
    const entries: VtableSlot[] = [];
    const claimedNames: Set<string> = new Set();

    for (const { field, slot } of slots) {
        const entry = vtableSlotEntry(context, field, claimedNames);

        if (entry !== undefined) {
            claimedNames.add(entry.key);
            entries.push({ ...entry, field, byteOffset: slot.byteOffset, vtableSize: size });
        }
    }

    return entries;
};

const collectVtable = (context: ModuleContext, namespaceName: string, klass: GirClass): Vtable | undefined => {
    const typeStruct = klass.glibTypeStruct;
    const resolved = typeStruct === undefined ? undefined : context.library.resolveType(namespaceName, typeStruct);

    if (typeStruct === undefined || resolved?.kind !== "record") {
        return undefined;
    }

    const slots = collectVtableSlots(context, resolved.value.fields, resolved.value.isUnion);

    if (slots.length === 0) {
        return undefined;
    }

    return {
        structName: pascalCase(typeStruct),
        kind: klass.isInterface ? "interface" : "class",
        slots,
    };
};

const vfuncMemberNames = (context: ModuleContext, namespaceName: string, klass: GirClass): string[] =>
    collectVtable(context, namespaceName, klass)?.slots.map((slot) => slot.key) ?? [];

const renderVfuncMetadata = (context: ModuleContext, klass: GirClass): string | undefined => {
    const vtable = collectVtable(context, context.namespace.name, klass);

    if (vtable === undefined) {
        return undefined;
    }

    const entries = vtable.slots.map((slot) => renderVtableSlotDescriptor(context, vtable, slot));

    return renderBraced(entries.join("\n"));
};

const renderVfuncMembers = (
    context: ModuleContext,
    klass: GirClass,
    ownerRef: string,
    mode: VfuncMemberMode,
): string[] => {
    const vtable = collectVtable(context, context.namespace.name, klass);

    if (vtable === undefined) {
        return [];
    }

    if (mode === "implementation") {
        context.addRuntimeImport("callVfunc");
    }

    return vtable.slots
        .filter((slot) => isCallableSlot(context, slot))
        .map((slot) => renderVfuncMember(context, ownerRef, slot, mode));
};

const hasUnannotatedPointerParam = (context: ModuleContext, slot: VtableSlot): boolean => {
    const [, ...parameters] = slot.callback.parameters;

    return parameters.some(
        (parameter) =>
            parameter.direction === "in" &&
            parameter.cType?.endsWith("*") === true &&
            isScalarRef(context.library, parameter.type),
    );
};

const isCallableSlot = (context: ModuleContext, slot: VtableSlot): boolean =>
    !UNCALLABLE_SLOT_KEYS.has(slot.key) && !hasUnannotatedPointerParam(context, slot);

const renderVfuncMember = (
    context: ModuleContext,
    ownerRef: string,
    slot: VtableSlot,
    mode: VfuncMemberMode,
): string => {
    const [, ...parameters] = slot.callback.parameters;

    const renderType = (ref: TypeId | undefined, isNullable: boolean): string =>
        renderTsType(context, ref, isNullable);

    const signature = renderHandlerParameters(parameters, renderType).join(", ");

    const returnType = renderHandlerResultType({
        library: context.library,
        signal: { ...slot.callback, parameters },
        renderType,
        shouldIncludeCallerAllocated: true,
        isOptOut: false,
    });

    const header = `${slot.key}(${signature}): ${returnType}`;
    const doc = renderJsDoc(slot.callback.doc);

    if (mode === "signature") {
        return `${doc}${header};`;
    }

    const inputs = handlerParameters(parameters).map((parameter, index) =>
        parameterIdentifier(parameter, index));

    const call = `callVfunc(${ownerRef}, ${sourceStringLiteral(slot.key)}, this, [${inputs.join(", ")}])`;
    const body = returnType === "void" ? `${call};` : `return ${call} as ${returnType};`;

    return `${doc}${renderBlock(header, body)}`;
};

const isUnsupportedOutParam = (context: ModuleContext, param: GirParameter): boolean =>
    (param.direction === "out" || param.direction === "inout") &&
    !param.callerAllocates &&
    !isScalarRef(context.library, param.type);

const isEligibleVtableParam = (context: ModuleContext, param: GirParameter): boolean => {
    if (param.isVarargs) {
        return false;
    }

    if (isUnsupportedOutParam(context, param)) {
        return false;
    }

    return !isInlineCallbackRef(context.library, param.type);
};

const isVtableSlotEligible = (context: ModuleContext, callback: GirCallback): boolean => {
    if (!callback.introspectable) {
        return false;
    }

    for (const param of callback.parameters) {
        if (!isEligibleVtableParam(context, param)) {
            return false;
        }
    }

    return !isInlineCallbackRef(context.library, callback.returnValue.type);
};

const renderVtableSlotDescriptor = (context: ModuleContext, vtable: Vtable, slot: VtableSlot): string => {
    const { key, field, callback, byteOffset, vtableSize } = slot;

    const argDescriptors = callback.parameters
        .map((param) => renderParamDescriptor(context, param, param.type))
        .join(", ");

    const returnDescriptor = renderDescriptor(
        context,
        callback.returnValue.type,
        callback.returnValue.transferOwnership,
    );

    const lines = [
        `kind: ${sourceStringLiteral(vtable.kind)} as const,`,
        `className: ${sourceStringLiteral(vtable.structName)},`,
        `vfuncName: ${sourceStringLiteral(field.name)},`,
        `byteOffset: ${String(byteOffset)},`,
        `vtableSize: ${String(vtableSize)},`,
        `argDescriptors: [${argDescriptors}],`,
        `returnDescriptor: ${returnDescriptor},`,
    ];

    return `${key}: ${renderBraced(lines.join("\n"))},`;
};

export { renderVfuncMetadata, renderVfuncMembers, vfuncMemberNames };
