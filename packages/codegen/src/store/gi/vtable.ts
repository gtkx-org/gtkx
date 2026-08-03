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
    foldedLengthParameters,
    handlerParameters,
    parameterIdentifier,
    renderHandlerParameters,
    renderHandlerResultType,
} from "../../analysis/param-structure.js";
import { renderTsType } from "../../analysis/ts-type.js";
import { ancestorChain, type ResolvedAncestor, resolveInterfaces } from "../../gir/ancestry.js";
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

type VfuncMemberOptions = {
    context: ModuleContext;
    ownerRef: string;
    slot: VtableSlot;
    mode: VfuncMemberMode;
    isProtected: boolean;
};

type Vtable = {
    structName: string;
    kind: VtableKind;
    slots: VtableSlot[];
};

const PADDING_FIELD_NAME = /^(?:reserved|padding)\d*$/i;

const UNCALLABLE_SLOT_KEYS: Set<string> = new Set([
    "vfuncDispose",
    "vfuncFinalize",
    "vfuncGetProperty",
    "vfuncSetProperty",
]);

const PROTECTED_SLOT_NOTE = "It is `protected`, so only a subclass chaining up reaches it.";
const PUBLIC_SLOT_NOTE = "Calling it from anywhere else re-enters the slot on a live instance.";

const vfuncMemberName = (fieldName: string): string => `vfunc${pascalCase(fieldName)}`;

const vfuncMemberNote = (slot: VtableSlot, isProtected: boolean): string =>
    [
        `Invokes the \`${slot.field.name}\` vtable slot. Override it on a class passed to \`registerClass\``,
        `and chain up with \`super.${slot.key}()\`.`,
        isProtected ? PROTECTED_SLOT_NOTE : PUBLIC_SLOT_NOTE,
    ].join("\n");

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

const slotIdentity = (slot: VtableSlot): string => `${slot.key}:${String(slot.byteOffset)}`;

const inheritedSlotIdentities = (context: ModuleContext, klass: GirClass): Set<string> => {
    const identities: Set<string> = new Set();
    const [, ...ancestors] = [...ancestorChain(context.library, klass, context.namespace.name)];

    for (const ancestor of ancestors) {
        const vtable = collectVtable(context, ancestor.namespaceName, ancestor.klass);
        const slots = vtable?.slots ?? [];

        for (const slot of slots) {
            identities.add(slotIdentity(slot));
        }
    }

    return identities;
};

const addInterfaceSlotKeys = (
    context: ModuleContext,
    iface: ResolvedAncestor,
    keys: Set<string>,
    seen: Set<string>,
): void => {
    const identity = `${iface.namespaceName}.${iface.klass.name}`;

    if (seen.has(identity)) {
        return;
    }

    seen.add(identity);

    for (const key of vfuncMemberNames(context, iface.namespaceName, iface.klass)) {
        keys.add(key);
    }

    for (const ref of resolveInterfaces(context.library, iface.namespaceName, iface.klass.prerequisites)) {
        addInterfaceSlotKeys(context, ref, keys, seen);
    }
};

const implementedSlotKeys = (context: ModuleContext, klass: GirClass): Set<string> => {
    const keys: Set<string> = new Set();
    const seen: Set<string> = new Set();

    for (const ancestor of ancestorChain(context.library, klass, context.namespace.name)) {
        for (const ref of resolveInterfaces(context.library, ancestor.namespaceName, ancestor.klass.implements)) {
            addInterfaceSlotKeys(context, ref, keys, seen);
        }
    }

    return keys;
};

const protectedSlotKeys = (context: ModuleContext, klass: GirClass, vtable: Vtable): Set<string> => {
    if (vtable.kind !== "class") {
        return new Set();
    }

    const shared = implementedSlotKeys(context, klass);

    return new Set(vtable.slots.map((slot) => slot.key).filter((key) => !shared.has(key)));
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

    const inherited = inheritedSlotIdentities(context, klass);
    const protectedKeys = protectedSlotKeys(context, klass, vtable);

    return vtable.slots
        .filter((slot) => isCallableSlot(context, slot) && !inherited.has(slotIdentity(slot)))
        .map((slot) =>
            renderVfuncMember({ context, ownerRef, slot, mode, isProtected: protectedKeys.has(slot.key) }));
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

const renderVfuncMember = (options: VfuncMemberOptions): string => {
    const { context, ownerRef, slot, mode, isProtected } = options;
    const [, ...parameters] = slot.callback.parameters;

    const renderType = (ref: TypeId | undefined, isNullable: boolean): string =>
        renderTsType(context, ref, isNullable);

    const signature = renderHandlerParameters(parameters, renderType).join(", ");
    const folded = foldedLengthParameters(context.library, slot.callback);

    const returnType = renderHandlerResultType({
        library: context.library,
        signal: { ...slot.callback, parameters },
        renderType,
        shouldIncludeCallerAllocated: true,
        isOptOut: false,
        shouldExcludeOut: (parameter) => folded.has(parameter),
    });

    const modifier = isProtected ? "protected " : "";
    const header = `${modifier}${slot.key}(${signature}): ${returnType}`;
    const doc = renderJsDoc(slot.field.doc ?? slot.callback.doc, vfuncMemberNote(slot, isProtected));

    if (mode === "signature") {
        return `${doc}${header};`;
    }

    const inputs = handlerParameters(parameters).map((parameter, index) =>
        parameterIdentifier(parameter, index));

    const call = `callVfunc(${ownerRef}, ${sourceStringLiteral(slot.key)}, this, [${inputs.join(", ")}])`;
    const body = returnType === "void" ? `${call};` : `return ${call} as ${returnType};`;

    return `${doc}${renderBlock(header, body)}`;
};

const isEligibleVtableParam = (context: ModuleContext, param: GirParameter): boolean => {
    if (param.isVarargs) {
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
