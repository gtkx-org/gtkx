import { quote, toCamelIdentifier, toPascalCase } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import { indent } from "../dsl/emit.js";
import type { GirCallback } from "../gir/callback.js";
import type { GirClass } from "../gir/class.js";
import type { GirField } from "../gir/field.js";
import { computeBoxedFieldSlots } from "./boxed-layout.js";
import { isInlineCallbackRef, isScalarRef, renderFfiType, renderHandlerArgType } from "./value.js";

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
 * marshalled (non-introspectable, variadic, a non-scalar out/inout parameter
 * that is not caller-allocated, or nested callbacks) are omitted; scalar
 * out/inout parameters are emitted as `t.ref` cells. The `kind` discriminator
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
        if (field.type === undefined) continue;
        const type = context.repository.typeOf(field.type);
        if (type?.kind !== "callback" || context.repository.nameOf(field.type) !== undefined) continue;
        const key = toCamelIdentifier(field.name);
        if (key === "constructor" || claimedNames.has(key)) continue;
        const callback = type.value;
        if (!isVtableSlotEligible(context, callback)) continue;
        claimedNames.add(key);
        entries.push(
            renderDescriptor(context, { key, structName, kind, field, callback, byteOffset: slot.byteOffset }),
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
            !isScalarRef(context.repository, param.type)
        ) {
            return false;
        }
        if (isInlineCallbackRef(context.repository, param.type)) return false;
    }
    return !isInlineCallbackRef(context.repository, callback.returnValue.type);
};

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
    const argTypes = callback.parameters.map((param) => renderHandlerArgType(context, param, param.type)).join(", ");
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
