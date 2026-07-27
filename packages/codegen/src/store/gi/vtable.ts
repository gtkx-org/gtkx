import { pascalCase, sourceStringLiteral, toCamelIdentifier } from "@gtkx/utils";
import type { GirCallback } from "../../gir/callback.js";
import type { GirClass } from "../../gir/class.js";
import type { GirField } from "../../gir/field.js";
import type { GirParameter } from "../../gir/parameter.js";
import type { ModuleContext } from "../../writer/context.js";
import {
    isInlineCallbackRef,
    isScalarRef,
    renderDescriptor,
    renderParamDescriptor,
} from "../../analysis/descriptor-render.js";
import { renderBraced } from "../../writer/emit.js";
import { computeRecordFieldSlots } from "./record-layout.js";

type VtableKind = "class" | "interface";

type RenderVtableSlotDescriptorOptions = {
    key: string;
    structName: string;
    kind: VtableKind;
    field: GirField;
    callback: GirCallback;
    byteOffset: number;
    vtableSize: number;
};

const renderVfuncMetadata = (context: ModuleContext, klass: GirClass): string | undefined => {
    if (klass.glibTypeStruct === undefined) {
        return undefined;
    }

    const structName = pascalCase(klass.glibTypeStruct);
    const kind: VtableKind = klass.isInterface ? "interface" : "class";
    const entries = vtableEntries(context, structName, kind, klass.glibTypeStruct);

    if (entries.length === 0) {
        return undefined;
    }

    return renderBraced(entries.join("\n"));
};

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
    const callback = vtableCallbackType(context, field);

    if (callback === undefined) {
        return undefined;
    }

    const key = toCamelIdentifier(field.name);

    if (key === "constructor" || claimedNames.has(key)) {
        return undefined;
    }

    if (!isVtableSlotEligible(context, callback)) {
        return undefined;
    }

    return { key, callback };
};

const vtableEntries = (context: ModuleContext, structName: string, kind: VtableKind, typeStruct: string): string[] => {
    const resolved = context.library.resolveType(context.namespace.name, typeStruct);

    if (resolved?.kind !== "record") {
        return [];
    }

    const { slots, size } = computeRecordFieldSlots(context, resolved.value.fields, resolved.value.isUnion);
    const entries: string[] = [];
    const claimedNames: Set<string> = new Set();

    for (const { field, slot } of slots) {
        const entry = vtableSlotEntry(context, field, claimedNames);

        if (entry === undefined) {
            continue;
        }

        claimedNames.add(entry.key);

        entries.push(
            renderVtableSlotDescriptor(context, {
                key: entry.key,
                structName,
                kind,
                field,
                callback: entry.callback,
                byteOffset: slot.byteOffset,
                vtableSize: size,
            }),
        );
    }

    return entries;
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

const renderVtableSlotDescriptor = (context: ModuleContext, options: RenderVtableSlotDescriptorOptions): string => {
    const { key, structName, kind, field, callback, byteOffset, vtableSize } = options;

    const argDescriptors = callback.parameters
        .map((param) => renderParamDescriptor(context, param, param.type))
        .join(", ");

    const returnDescriptor = renderDescriptor(
        context,
        callback.returnValue.type,
        callback.returnValue.transferOwnership,
    );

    const lines = [
        `kind: ${sourceStringLiteral(kind)} as const,`,
        `className: ${sourceStringLiteral(structName)},`,
        `vfuncName: ${sourceStringLiteral(field.name)},`,
        `byteOffset: ${String(byteOffset)},`,
        `vtableSize: ${String(vtableSize)},`,
        `argDescriptors: [${argDescriptors}],`,
        `returnDescriptor: ${returnDescriptor},`,
    ];

    return `${key}: ${renderBraced(lines.join("\n"))},`;
};

export { renderVfuncMetadata };
