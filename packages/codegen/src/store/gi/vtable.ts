import { sourceStringLiteral, toCamelIdentifier, toPascalCase } from "@gtkx/utils";
import {
    isInlineCallbackRef,
    isScalarRef,
    renderDescriptor,
    renderParamDescriptor,
} from "../../analysis/descriptor-render.js";
import type { GirCallback } from "../../gir/callback.js";
import type { GirClass } from "../../gir/class.js";
import type { GirField } from "../../gir/field.js";
import type { ModuleContext } from "../../writer/context.js";
import { renderBraced } from "../../writer/emit.js";
import { computeRecordFieldSlots } from "./record-layout.js";

type VtableKind = "class" | "interface";

export const renderVfuncMetadata = (context: ModuleContext, klass: GirClass): string | undefined => {
    if (klass.glibTypeStruct === undefined) return undefined;
    const structName = toPascalCase(klass.glibTypeStruct);
    const kind: VtableKind = klass.isInterface ? "interface" : "class";
    const entries = vtableEntries(context, structName, kind, klass.glibTypeStruct);
    if (entries.length === 0) return undefined;
    return renderBraced(entries.join("\n"));
};

const vtableEntries = (context: ModuleContext, structName: string, kind: VtableKind, typeStruct: string): string[] => {
    const resolved = context.library.resolveType(context.namespace.name, typeStruct);
    if (resolved === undefined || resolved.kind !== "record") return [];
    const { slots } = computeRecordFieldSlots(context, resolved.value.fields, resolved.value.isUnion);
    const entries: string[] = [];
    const claimedNames = new Set<string>();
    for (const { field, slot } of slots) {
        if (field.type === undefined) continue;
        const type = context.library.typeOf(field.type);
        if (type?.kind !== "callback" || context.library.nameOf(field.type) !== undefined) continue;
        const key = toCamelIdentifier(field.name);
        if (key === "constructor" || claimedNames.has(key)) continue;
        const callback = type.value;
        if (!isVtableSlotEligible(context, callback)) continue;
        claimedNames.add(key);
        entries.push(
            renderVtableSlotDescriptor(context, {
                key,
                structName,
                kind,
                field,
                callback,
                byteOffset: slot.byteOffset,
            }),
        );
    }
    return entries;
};

const isVtableSlotEligible = (context: ModuleContext, callback: GirCallback): boolean => {
    if (!callback.introspectable) return false;
    for (const param of callback.parameters) {
        if (param.isVarargs) return false;
        if (
            (param.direction === "out" || param.direction === "inout") &&
            !param.callerAllocates &&
            !isScalarRef(context.library, param.type)
        ) {
            return false;
        }
        if (isInlineCallbackRef(context.library, param.type)) return false;
    }
    return !isInlineCallbackRef(context.library, callback.returnValue.type);
};

type RenderVtableSlotDescriptorOptions = {
    key: string;
    structName: string;
    kind: VtableKind;
    field: GirField;
    callback: GirCallback;
    byteOffset: number;
};

const renderVtableSlotDescriptor = (context: ModuleContext, options: RenderVtableSlotDescriptorOptions): string => {
    const { key, structName, kind, field, callback, byteOffset } = options;
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
        `byteOffset: ${byteOffset},`,
        `argDescriptors: [${argDescriptors}],`,
        `returnDescriptor: ${returnDescriptor},`,
    ];
    return `${key}: ${renderBraced(lines.join("\n"))},`;
};
