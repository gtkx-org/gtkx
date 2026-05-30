import type { ModuleContext } from "../dsl/context.js";
import { indent, quote } from "../dsl/emit.js";
import { camelCase } from "../dsl/identifier.js";
import type { GirBoxed } from "../gir/boxed.js";
import { computeBoxedFieldSlots } from "./boxed-layout.js";
import { writeFfiType } from "./value.js";

/**
 * Renders the `{ kind: "boxed", … }` construction-meta fragment for a boxed
 * record descriptor.
 *
 * The meta records the struct size, GLib type/library (for the boxed
 * allocator), and per-field byte offsets keyed by camelCase JS name. Vtable
 * records are skipped; plain structs without a GType also skip registration
 * because they cannot be constructed through the meta path. Returns `undefined`
 * for those skipped records.
 *
 * @param ctx - The module context
 * @param boxed - The boxed record to register
 */
export const renderBoxedConstructionMeta = (ctx: ModuleContext, boxed: GirBoxed): string | undefined => {
    if (boxed.flavor === "vtable") return undefined;
    if (boxed.glibGetType === undefined && boxed.disguised) return undefined;
    const { slots, size } = computeBoxedFieldSlots(ctx, boxed.fields, boxed.isUnion);
    const fieldsLiteral = renderBoxedFieldsLiteral(ctx, slots);
    const lib = ctx.namespace.sharedLibrary;
    const glibTypeName = boxed.glibTypeName ?? boxed.cType;
    const lines: string[] = [`kind: "boxed"`, `size: ${size}`];
    if (glibTypeName !== undefined) lines.push(`glibTypeName: ${quote(glibTypeName)}`);
    if (lib !== undefined) lines.push(`lib: ${quote(lib)}`);
    lines.push(`fields: ${fieldsLiteral}`);
    return `{\n${indent(lines.join(",\n"), 1)},\n}`;
};

type BoxedFieldSlot = ReturnType<typeof computeBoxedFieldSlots>["slots"][number];

const renderBoxedFieldsLiteral = (ctx: ModuleContext, slots: readonly BoxedFieldSlot[]): string => {
    const fieldEntries: string[] = [];
    for (const { field, slot } of slots) {
        const entry = renderBoxedFieldEntry(ctx, field, slot);
        if (entry !== undefined) fieldEntries.push(entry);
    }
    return fieldEntries.length === 0 ? "{}" : `{\n${indent(fieldEntries.join(",\n"), 1)},\n}`;
};

const renderBoxedFieldEntry = (
    ctx: ModuleContext,
    field: BoxedFieldSlot["field"],
    slot: BoxedFieldSlot["slot"],
): string | undefined => {
    if (field.private) return undefined;
    if (!field.writable) return undefined;
    if (field.callback !== undefined) return undefined;
    if (field.type === undefined) return undefined;
    const ffiType = writeFfiType(ctx, field.type, "none");
    const jsName = camelCase(field.name);
    const parts = [`offset: ${slot.byteOffset}`, `ffiType: ${ffiType}`];
    if (slot.bitWidth !== undefined) {
        parts.push(`bitOffset: ${slot.bitOffset ?? 0}`, `bitWidth: ${slot.bitWidth}`);
    }
    return `${jsName}: { ${parts.join(", ")} }`;
};
