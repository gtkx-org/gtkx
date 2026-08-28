import { pascalCase, sanitizeTypeIdentifier, sourceStringLiteral } from "@gtkx/utils";
import type { GirClass, GirVirtualMethod } from "../../gir/class.js";
import type { GirField } from "../../gir/field.js";
import type { GirFunction } from "../../gir/function.js";
import type { Library } from "../../gir/library.js";
import type { GirParameter } from "../../gir/parameter.js";
import type { GirRecord } from "../../gir/record.js";
import type { TypeId } from "../../gir/type-id.js";
import type { ModuleContext } from "../../writer/context.js";
import type { JsDocSpec } from "../../writer/doc.js";
import {
    isInlineCallbackRef,
    isScalarRef,
    renderCallbackType,
    renderDescriptor,
    renderParamDescriptor,
} from "../../analysis/descriptor-render.js";
import {
    foldedLengthParameters,
    handlerParameters,
    parameterIdentifier,
    renamesWithInstance,
    renderHandlerResultType,
} from "../../analysis/param-structure.js";
import { renderTsType } from "../../analysis/ts-type.js";
import { typeKey } from "../../analysis/type-key.js";
import { ancestorChain, type ResolvedAncestor, resolveInterfaces } from "../../gir/ancestry.js";
import { callbackAsFunction, type GirCallback } from "../../gir/callback.js";
import { renderJsDoc } from "../../writer/doc.js";
import { renderBlock, renderBraced } from "../../writer/emit.js";
import { handlerSpec, THROWS_TEXT } from "./doc-spec.js";
import { computeRecordFieldSlots } from "./record-layout.js";

type VtableKind = "class" | "interface";
type VfuncMemberMode = "implementation" | "requirement" | "signature";

type VtableSlot = {
    key: string;
    field: GirField;
    callback: GirCallback;
    vfunc: GirVirtualMethod | undefined;
    byteOffset: number;
};

type VfuncMemberOptions = {
    context: ModuleContext;
    ownerRef: string;
    slot: VtableSlot;
    mode: VfuncMemberMode;
    isProtected: boolean;
};

type VfuncMembersOptions = {
    context: ModuleContext;
    klass: GirClass;
    mode: VfuncMemberMode;
};

type VfuncSignature = {
    header: string;
    returnType: string;
};

type VfuncEntry = {
    name: string;
    signature: string;
    doc: string | undefined;
};

type Vtable = {
    structName: string;
    kind: VtableKind;
    vtableSize: number;
    slots: VtableSlot[];
};

type SlotParamPlan = {
    parameters: GirParameter[];
    argIndexMap: Map<number, number>;
    decoded: Set<GirParameter>;
};

const PADDING_FIELD_NAME = /^(?:reserved|padding)\d*$/i;

const UNCALLABLE_SLOT_KEYS: Set<string> = new Set([
    "vfuncDispose",
    "vfuncFinalize",
    "vfuncGetProperty",
    "vfuncSetProperty",
]);

const VTABLE_CACHE: WeakMap<GirClass, Vtable> = new WeakMap();
const PROTECTED_SLOT_NOTE = "It is `protected`, so only a subclass chaining up reaches it.";
const PUBLIC_SLOT_NOTE = "Calling it from anywhere else re-enters the slot on a live instance.";
const OPAQUE_CALLBACK_NOTE = "Received as the raw address of the C function pointer.";

const vfuncMemberName = (fieldName: string): string => `vfunc${pascalCase(fieldName)}`;

const vfuncOverrideNote = (slot: VtableSlot, isProtected: boolean): string =>
    [
        `Invokes the \`${slot.field.name}\` vtable slot. Override it on a class passed to \`registerClass\``,
        `and chain up with \`super.${slot.key}()\`.`,
        isProtected ? PROTECTED_SLOT_NOTE : PUBLIC_SLOT_NOTE,
    ].join("\n");

const vfuncRequirementNote = (slot: VtableSlot, ownerRef: string): string =>
    [
        `Fills the \`${slot.field.name}\` vtable slot. Declare it on a class passed to \`registerClass\``,
        `with \`${ownerRef}\` in \`implements\`, which installs it in the interface vtable. Leaving it out`,
        "keeps whatever the interface installs by default, the way it does for a C implementer.",
    ].join("\n");

const vfuncMemberNote = (options: VfuncMemberOptions): string =>
    options.mode === "requirement"
        ? vfuncRequirementNote(options.slot, options.ownerRef)
        : vfuncOverrideNote(options.slot, options.isProtected);

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

const isCallbackParam = (context: ModuleContext, parameter: GirParameter): boolean =>
    parameter.type !== undefined && context.library.typeFor(parameter.type)?.kind === "callback";

const isDecodedCallbackParam = (context: ModuleContext, parameter: GirParameter, index: number): boolean =>
    isCallbackParam(context, parameter) &&
    parameter.closureIndex === index + 1 &&
    parameter.destroyIndex === undefined;

const decodedSlotParams = (context: ModuleContext, callback: GirCallback): Set<GirParameter> => {
    const decoded: Set<GirParameter> = new Set();

    for (const [index, parameter] of callback.parameters.entries()) {
        if (isDecodedCallbackParam(context, parameter, index)) {
            decoded.add(parameter);
        }
    }

    return decoded;
};

const companionIndices = (decoded: Set<GirParameter>): Set<number> => {
    const companions: Set<number> = new Set();

    for (const parameter of decoded) {
        if (parameter.closureIndex !== undefined) {
            companions.add(parameter.closureIndex);
        }
    }

    return companions;
};

const slotParamPlan = (context: ModuleContext, callback: GirCallback): SlotParamPlan => {
    const decoded = decodedSlotParams(context, callback);
    const companions = companionIndices(decoded);
    const parameters: GirParameter[] = [];
    const argIndexMap: Map<number, number> = new Map();

    for (const [index, parameter] of callback.parameters.entries()) {
        if (companions.has(index)) {
            continue;
        }

        argIndexMap.set(index, parameters.length);
        parameters.push(parameter);
    }

    return { parameters, argIndexMap, decoded };
};

const isOpaqueCallbackParam = (context: ModuleContext, plan: SlotParamPlan, parameter: GirParameter): boolean =>
    isCallbackParam(context, parameter) && !plan.decoded.has(parameter);

const renderSlotParamDescriptor = (context: ModuleContext, parameter: GirParameter, plan: SlotParamPlan): string => {
    if (plan.decoded.has(parameter)) {
        const callbackDescriptor = renderCallbackType(context, parameter.type, parameter);

        if (callbackDescriptor !== undefined) {
            return callbackDescriptor;
        }
    }

    return renderParamDescriptor(context, parameter, parameter.type, { argIndexMap: plan.argIndexMap });
};

const renderSlotParamTsType = (context: ModuleContext, plan: SlotParamPlan, parameter: GirParameter): string => {
    if (isOpaqueCallbackParam(context, plan, parameter)) {
        return parameter.nullable ? "bigint | null" : "bigint";
    }

    return renderTsType(context, parameter.type, parameter.nullable);
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

const collectVtableSlots = (
    context: ModuleContext,
    fields: GirField[],
    isUnion: boolean,
): { slots: VtableSlot[]; vtableSize: number } => {
    const { slots, size } = computeRecordFieldSlots(context, fields, isUnion);
    const entries: VtableSlot[] = [];
    const claimedNames: Set<string> = new Set();

    for (const { field, slot } of slots) {
        const entry = vtableSlotEntry(context, field, claimedNames);

        if (entry !== undefined) {
            claimedNames.add(entry.key);
            entries.push({ ...entry, field, vfunc: undefined, byteOffset: slot.byteOffset });
        }
    }

    return { slots: entries, vtableSize: size };
};

const resolveVtableRecord = (
    context: ModuleContext,
    namespaceName: string,
    klass: GirClass,
): { typeStruct: string; record: GirRecord } | undefined => {
    const typeStruct = klass.glibTypeStruct;
    const resolved = typeStruct === undefined ? undefined : context.library.resolveType(namespaceName, typeStruct);

    if (typeStruct === undefined || resolved?.kind !== "record" || resolved.value.fields.length === 0) {
        return undefined;
    }

    return { typeStruct, record: resolved.value };
};

const attachVirtualMethods = (slots: VtableSlot[], klass: GirClass): VtableSlot[] => {
    const byKey: Map<string, GirVirtualMethod> = new Map(
        klass.vfuncs.map((vfunc) => [vfuncMemberName(vfunc.name), vfunc]),
    );

    return slots.map((slot) => ({ ...slot, vfunc: byKey.get(slot.key) }));
};

const buildVtable = (context: ModuleContext, namespaceName: string, klass: GirClass): Vtable | undefined => {
    const resolved = resolveVtableRecord(context, namespaceName, klass);

    if (resolved === undefined) {
        return undefined;
    }

    const { slots, vtableSize } = collectVtableSlots(context, resolved.record.fields, resolved.record.isUnion);

    if (slots.length === 0) {
        return undefined;
    }

    return {
        structName: pascalCase(resolved.typeStruct),
        kind: klass.isInterface ? "interface" : "class",
        vtableSize,
        slots: disambiguateSlots(context, namespaceName, klass, attachVirtualMethods(slots, klass)),
    };
};

const collectVtable = (context: ModuleContext, namespaceName: string, klass: GirClass): Vtable | undefined => {
    const cached = VTABLE_CACHE.get(klass);

    if (cached !== undefined) {
        return cached;
    }

    const vtable = buildVtable(context, namespaceName, klass);

    if (vtable !== undefined) {
        VTABLE_CACHE.set(klass, vtable);
    }

    return vtable;
};

const shadowedSlotKey = (klass: GirClass, slot: VtableSlot): string =>
    `vfunc${sanitizeTypeIdentifier(klass.name)}${pascalCase(slot.field.name)}`;

const slotSignatureKey = (library: Library, slot: VtableSlot): string => {
    const [, ...parameters] = slot.callback.parameters;

    const parts = parameters.map(
        (parameter) => `${typeKey(library, parameter.type)}/${parameter.direction}/${String(parameter.nullable)}`);

    return `${parts.join(",")}->${typeKey(library, slot.callback.returnValue.type)}`;
};

const isShadowingSlot = (library: Library, slot: VtableSlot, inherited: VtableSlot[]): boolean =>
    inherited.some(
        (other) =>
            other.key === slot.key &&
            slotIdentity(other) !== slotIdentity(slot) &&
            slotSignatureKey(library, other) !== slotSignatureKey(library, slot));

const disambiguateSlots = (
    context: ModuleContext,
    namespaceName: string,
    klass: GirClass,
    slots: VtableSlot[],
): VtableSlot[] => {
    const inherited = ancestorSlots(context, namespaceName, klass);

    return slots.map((slot) =>
        isShadowingSlot(context.library, slot, inherited) ? { ...slot, key: shadowedSlotKey(klass, slot) } : slot);
};

const ancestorSlots = (context: ModuleContext, namespaceName: string, klass: GirClass): VtableSlot[] => {
    const [, ...ancestors] = [...ancestorChain(context.library, klass, namespaceName)];

    return ancestors.flatMap((ancestor) => collectVtable(context, ancestor.namespaceName, ancestor.klass)?.slots ?? []);
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

const inheritedSlotIdentities = (context: ModuleContext, namespaceName: string, klass: GirClass): Set<string> =>
    new Set(ancestorSlots(context, namespaceName, klass).map((slot) => slotIdentity(slot)));

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

const implementedSlotKeys = (context: ModuleContext, namespaceName: string, klass: GirClass): Set<string> => {
    const keys: Set<string> = new Set();
    const seen: Set<string> = new Set();

    for (const ancestor of ancestorChain(context.library, klass, namespaceName)) {
        for (const ref of resolveInterfaces(context.library, ancestor.namespaceName, ancestor.klass.implements)) {
            addInterfaceSlotKeys(context, ref, keys, seen);
        }
    }

    return keys;
};

const protectedSlotKeys = (options: VfuncMembersOptions, slots: VtableSlot[]): Set<string> => {
    const { context, klass } = options;

    if (klass.isInterface) {
        return new Set();
    }

    const shared = implementedSlotKeys(context, context.namespace.name, klass);

    return new Set(slots.map((slot) => slot.key).filter((key) => !shared.has(key)));
};

const vfuncCallables = (context: ModuleContext, namespaceName: string, klass: GirClass): Map<string, GirFunction> => {
    const members: Map<string, GirFunction> = new Map();

    for (const slot of callableVfuncSlots(context, namespaceName, klass)) {
        const [, ...parameters] = slot.callback.parameters;
        members.set(slot.key, { ...callbackAsFunction(slot.callback), parameters });
    }

    return members;
};

const addProtectedSlotKeys = (context: ModuleContext, ancestor: ResolvedAncestor, keys: Set<string>): void => {
    const shared = implementedSlotKeys(context, ancestor.namespaceName, ancestor.klass);

    for (const slot of callableVfuncSlots(context, ancestor.namespaceName, ancestor.klass)) {
        if (!shared.has(slot.key)) {
            keys.add(slot.key);
        }
    }
};

const protectedChainSlotKeys = (context: ModuleContext, klass: GirClass): Set<string> => {
    const keys: Set<string> = new Set();

    for (const ancestor of ancestorChain(context.library, klass, context.namespace.name)) {
        addProtectedSlotKeys(context, ancestor, keys);
    }

    return keys;
};

const callableVfuncSlots = (context: ModuleContext, namespaceName: string, klass: GirClass): VtableSlot[] => {
    const vtable = collectVtable(context, namespaceName, klass);

    if (vtable === undefined) {
        return [];
    }

    const inherited = inheritedSlotIdentities(context, namespaceName, klass);

    return vtable.slots.filter((slot) => isCallableSlot(context, slot) && !inherited.has(slotIdentity(slot)));
};

const hasCallableVfuncSlots = (context: ModuleContext, namespaceName: string, klass: GirClass): boolean =>
    callableVfuncSlots(context, namespaceName, klass).length > 0;

const slotDoc = (slot: VtableSlot): string | undefined => slot.vfunc?.doc ?? slot.field.doc ?? slot.callback.doc;

const slotParamDoc = (
    context: ModuleContext,
    plan: SlotParamPlan,
    parameter: GirParameter,
    doc: string | undefined,
): string | undefined => {
    if (!isOpaqueCallbackParam(context, plan, parameter)) {
        return doc;
    }

    return doc === undefined ? OPAQUE_CALLBACK_NOTE : `${doc} ${OPAQUE_CALLBACK_NOTE}`;
};

const slotDocParameters = (context: ModuleContext, slot: VtableSlot): GirParameter[] => {
    const plan = slotParamPlan(context, slot.callback);
    const [, ...parameters] = slot.callback.parameters;
    const vfuncParameters = slot.vfunc?.parameters ?? [];

    return parameters
        .map((parameter, index) => ({ parameter, index }))
        .filter(({ index }) => plan.argIndexMap.has(index + 1))
        .map(({ parameter, index }) => ({
            ...parameter,
            doc: slotParamDoc(context, plan, parameter, vfuncParameters[index]?.doc ?? parameter.doc),
        }));
};

const slotDocSpec = (context: ModuleContext, slot: VtableSlot): JsDocSpec => {
    const parameters = slotDocParameters(context, slot);
    const source = slot.vfunc ?? slot.callback;

    return {
        ...handlerSpec(source, parameters, renamesWithInstance(parameters, slot.callback.parameters[0])),
        returns: slot.vfunc?.returnValue.doc ?? slot.callback.returnValue.doc,
        throws: slot.callback.throws ? THROWS_TEXT : undefined,
    };
};

const vfuncEntries = (context: ModuleContext, namespaceName: string, klass: GirClass): VfuncEntry[] =>
    callableVfuncSlots(context, namespaceName, klass).map((slot) => ({
        name: slot.key,
        signature: vfuncSlotSignature(context, slot).header,
        doc: slotDoc(slot),
    }));

const renderVfuncMembers = (options: VfuncMembersOptions): string[] => {
    const { context, klass, mode } = options;
    const ownerRef = sanitizeTypeIdentifier(klass.name);
    const slots = callableVfuncSlots(context, context.namespace.name, klass);

    if (slots.length === 0) {
        return [];
    }

    if (mode === "implementation") {
        context.addRuntimeImport("callVfunc");
    }

    const protectedKeys = protectedSlotKeys(options, slots);

    return slots.map((slot) =>
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

const vfuncSlotSignature = (context: ModuleContext, slot: VtableSlot, isOptional = false): VfuncSignature => {
    const plan = slotParamPlan(context, slot.callback);
    const [, ...parameters] = plan.parameters;

    const renderType = (ref: TypeId | undefined, isNullable: boolean): string =>
        renderTsType(context, ref, isNullable);

    const signature = handlerParameters(parameters)
        .map(
            (parameter, index) =>
                `${parameterIdentifier(parameter, index)}: ${renderSlotParamTsType(context, plan, parameter)}`)
        .join(", ");

    const folded = foldedLengthParameters(context.library, slot.callback);

    const returnType = renderHandlerResultType({
        library: context.library,
        signal: { ...slot.callback, parameters },
        renderType,
        shouldIncludeCallerAllocated: true,
        isOptOut: false,
        shouldExcludeOut: (parameter) => folded.has(parameter),
    });

    return { header: `${slot.key}${isOptional ? "?" : ""}(${signature}): ${returnType}`, returnType };
};

const renderVfuncMember = (options: VfuncMemberOptions): string => {
    const { context, ownerRef, slot, mode, isProtected } = options;
    const { header, returnType } = vfuncSlotSignature(context, slot, mode === "requirement");
    const declaration = `${isProtected ? "protected " : ""}${header}`;
    const doc = renderJsDoc(slotDoc(slot), vfuncMemberNote(options), slotDocSpec(context, slot));

    if (mode !== "implementation") {
        return `${doc}${declaration};`;
    }

    const [, ...parameters] = slotParamPlan(context, slot.callback).parameters;

    const inputs = handlerParameters(parameters).map((parameter, index) =>
        parameterIdentifier(parameter, index));

    const call = `callVfunc(${ownerRef}, ${sourceStringLiteral(slot.key)}, this, [${inputs.join(", ")}])`;
    const body = returnType === "void" ? `${call};` : `return ${call} as ${returnType};`;

    return `${doc}${renderBlock(declaration, body)}`;
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
    const { key, field, callback, byteOffset } = slot;
    const plan = slotParamPlan(context, callback);

    const argDescriptors = plan.parameters
        .map((param) => renderSlotParamDescriptor(context, param, plan))
        .join(", ");

    const returnDescriptor = renderDescriptor(
        context,
        callback.returnValue.type,
        callback.returnValue.transferOwnership,
        { isReceived: true },
    );

    const lines = [
        `className: ${sourceStringLiteral(vtable.structName)},`,
        `vfuncName: ${sourceStringLiteral(field.name)},`,
        `byteOffset: ${String(byteOffset)},`,
    ];

    if (vtable.kind === "interface") {
        lines.push(`vtableSize: ${String(vtable.vtableSize)},`);
    }

    lines.push(`argDescriptors: [${argDescriptors}],`, `returnDescriptor: ${returnDescriptor},`);

    if (callback.throws) {
        lines.push("canThrow: true,");
    }

    return `${key}: ${renderBraced(lines.join("\n"))},`;
};

export {
    hasCallableVfuncSlots,
    protectedChainSlotKeys,
    renderVfuncMembers,
    vfuncCallables,
    renderVfuncMetadata,
    vfuncEntries,
    vfuncMemberNames,
    type VfuncMemberMode,
};
