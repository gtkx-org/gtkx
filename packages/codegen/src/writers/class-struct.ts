import { quote, toCamelCase, toIdentifier, toPascalCase } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import { indent } from "../dsl/emit.js";
import { callbackFromNode, type GirCallback } from "../gir/callback.js";
import type { GirClass } from "../gir/class.js";
import type { GirField } from "../gir/field.js";
import type { GirTypeRef } from "../gir/type-ref.js";
import { computeBoxedFieldSlots } from "./boxed-layout.js";
import { renderFfiType } from "./value.js";

type VtableKind = "class" | "interface";

/**
 * Renders the `{ … }` vtable descriptor literal for a class or interface
 * descriptor's `vfuncs` field, or `undefined` when the type exposes no
 * marshallable slots.
 *
 * Each entry describes one overridable vtable slot — keyed by the slot's
 * camelCase name and carrying `{ kind, className, vfuncName, byteOffset,
 * argTypes, returnType }` — so the runtime `registerClass` can auto-discover
 * a subclass method, locate the matching slot by byte offset, and register a
 * trampoline with the correct marshalling. Slots whose signature cannot be
 * marshalled (non-introspectable, variadic, out-parameters without
 * caller-allocates, or nested callbacks) are omitted. The `kind` discriminator
 * lets the runtime register an interface vfunc mapping in addition to the class
 * one when the descriptor's role is `"interface"`.
 *
 * @param context - The module context
 * @param klass - The class or interface
 */
export const renderVfuncMetadata = (context: ModuleContext, klass: GirClass): string | undefined => {
    if (klass.glibTypeStruct === undefined) return undefined;
    const structName = toPascalCase(klass.glibTypeStruct);
    const kind: VtableKind = klass.isInterface ? "interface" : "class";
    const entries = vtableEntries(context, structName, kind, klass.glibTypeStruct);
    if (entries.length === 0) return undefined;
    return `{\n${entries.map((entry) => indent(entry, 1)).join("\n")}\n}`;
};

const vtableEntries = (context: ModuleContext, structName: string, kind: VtableKind, typeStruct: string): string[] => {
    const resolved = context.repository.resolveNamed(context.namespace.name, typeStruct);
    if (resolved === undefined || resolved.kind !== "boxed") return [];
    const { slots } = computeBoxedFieldSlots(context, resolved.value.fields, resolved.value.isUnion);
    const entries: string[] = [];
    const claimedNames = new Set<string>();
    for (const { field, slot } of slots) {
        if (field.callback === undefined) continue;
        const key = toIdentifier(toCamelCase(field.name));
        if (key === "constructor" || claimedNames.has(key)) continue;
        const callback = callbackFromNode(field.callback);
        if (!isVtableSlotEligible(callback)) continue;
        claimedNames.add(key);
        entries.push(
            renderDescriptor(context, { key, structName, kind, field, callback, byteOffset: slot.byteOffset }),
        );
    }
    return entries;
};

const isVtableSlotEligible = (callback: GirCallback): boolean => {
    if (!callback.introspectable) return false;
    for (const param of callback.parameters) {
        if (param.isVarargs) return false;
        if ((param.direction === "out" || param.direction === "inout") && !param.callerAllocates) return false;
        if (isCallbackRef(param.type)) return false;
    }
    return !isCallbackRef(callback.returnValue.type);
};

const isCallbackRef = (ref: GirTypeRef | undefined): boolean => ref?.kind === "callback";

type RenderDescriptorOptions = {
    readonly key: string;
    readonly structName: string;
    readonly kind: VtableKind;
    readonly field: GirField;
    readonly callback: GirCallback;
    readonly byteOffset: number;
};

const renderDescriptor = (context: ModuleContext, options: RenderDescriptorOptions): string => {
    const { key, structName, kind, field, callback, byteOffset } = options;
    const argTypes = callback.parameters
        .map((param) => renderFfiType(context, param.type, param.transferOwnership))
        .join(", ");
    const returnType = renderFfiType(context, callback.returnValue.type, callback.returnValue.transferOwnership);
    const lines = [
        `kind: ${quote(kind)},`,
        `className: ${quote(structName)},`,
        `vfuncName: ${quote(field.name)},`,
        `byteOffset: ${byteOffset},`,
        `argTypes: [${argTypes}],`,
        `returnType: ${returnType},`,
    ];
    return `${key}: {\n${lines.map((line) => indent(line, 1)).join("\n")}\n},`;
};
