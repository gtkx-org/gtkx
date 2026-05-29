import type { ModuleContext } from "../dsl/context.js";
import { indent } from "../dsl/emit.js";
import { camelCase, pascalCase } from "../dsl/identifier.js";
import { callbackFromNode, type GirCallback } from "../gir/callback.js";
import type { GirClass } from "../gir/class.js";
import type { GirField } from "../gir/field.js";
import type { GirTypeRef } from "../gir/type-ref.js";
import { computeBoxedFieldSlots } from "./boxed-field-accessor.js";
import { writeFfiType } from "./value.js";

type VtableKind = "class" | "interface";

/**
 * Emits the `const XxxClass = { … }` vtable descriptor registry and the
 * trailing `setClassStruct(Class, XxxClass)` (and, for interfaces, the
 * additional `registerInterfaceClassStruct(...)`) call for `klass`.
 *
 * Each entry describes one overridable vtable slot — keyed by the slot's
 * camelCase name and carrying `{ kind, className, vfuncName, byteOffset,
 * argTypes, returnType }` — so the runtime `registerClass` can auto-discover
 * a subclass method, locate the matching slot by byte offset, and register a
 * trampoline with the correct marshalling. Slots whose signature cannot be
 * marshalled (non-introspectable, variadic, out-parameters without
 * caller-allocates, or nested callbacks) are omitted.
 *
 * @param ctx - The module context
 * @param klass - The class or interface
 */
export const emitClassStruct = (ctx: ModuleContext, klass: GirClass): void => {
    if (klass.glibTypeStruct === undefined) return;
    const className = pascalCase(klass.name);
    const structName = pascalCase(klass.glibTypeStruct);
    const kind: VtableKind = klass.isInterface ? "interface" : "class";
    const entries = vtableEntries(ctx, structName, kind, klass.glibTypeStruct);
    const body = entries.length === 0 ? "{}" : `{\n${entries.map((entry) => indent(entry, 1)).join("\n")}\n}`;
    ctx.addRuntimeImport("setClassStruct");
    ctx.module.appendRegistration(`const ${structName} = ${body};\nsetClassStruct(${className}, ${structName});`);
    if (klass.isInterface && klass.glibGetType !== undefined) {
        ctx.addRuntimeImport("registerInterfaceClassStruct");
        ctx.module.appendRegistration(`registerInterfaceClassStruct(${klass.glibGetType}(), ${structName});`);
    }
};

const vtableEntries = (ctx: ModuleContext, structName: string, kind: VtableKind, typeStruct: string): string[] => {
    const resolved = ctx.repository.resolveNamed(ctx.namespace.name, typeStruct);
    if (resolved === undefined || resolved.kind !== "boxed") return [];
    const { slots } = computeBoxedFieldSlots(ctx, resolved.value.fields, resolved.value.isUnion);
    const entries: string[] = [];
    const claimed = new Set<string>();
    for (const { field, slot } of slots) {
        if (field.callback === undefined) continue;
        const key = camelCase(field.name);
        if (key === "constructor" || claimed.has(key)) continue;
        const callback = callbackFromNode(field.callback);
        if (!isVtableSlotEligible(callback)) continue;
        claimed.add(key);
        entries.push(renderDescriptor(ctx, { key, structName, kind, field, callback, byteOffset: slot.byteOffset }));
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

type DescriptorInput = {
    readonly key: string;
    readonly structName: string;
    readonly kind: VtableKind;
    readonly field: GirField;
    readonly callback: GirCallback;
    readonly byteOffset: number;
};

const renderDescriptor = (ctx: ModuleContext, input: DescriptorInput): string => {
    const { key, structName, kind, field, callback, byteOffset } = input;
    const argTypes = callback.parameters
        .map((param) => writeFfiType(ctx, param.type, param.transferOwnership))
        .join(", ");
    const returnType = writeFfiType(ctx, callback.returnValue.type, callback.returnValue.transferOwnership);
    const lines = [
        `kind: ${JSON.stringify(kind)},`,
        `className: ${JSON.stringify(structName)},`,
        `vfuncName: ${JSON.stringify(field.name)},`,
        `byteOffset: ${byteOffset},`,
        `argTypes: [${argTypes}],`,
        `returnType: ${returnType},`,
    ];
    return `${key}: {\n${lines.map((line) => indent(line, 1)).join("\n")}\n},`;
};
