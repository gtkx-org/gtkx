import type { ModuleContext } from "../dsl/context.js";
import { indent, quote } from "../dsl/emit.js";
import { camelCase, pascalCase } from "../dsl/identifier.js";
import type { GirBoxed } from "../gir/boxed.js";
import type { GirClass } from "../gir/class.js";
import type { GirProperty } from "../gir/property.js";
import { computeBoxedFieldSlots } from "./boxed-field-accessor.js";
import { renderGetTypeReference } from "./gtype-binding.js";
import { collectInterfaceProperties } from "./inheritance.js";
import { writeFfiType } from "./value.js";

/**
 * Emits `registerConstructionMeta(Class, { kind: "gobject", ... })` for a
 * GObject class declaration.
 *
 * The meta lists every property the constructor accepts (writable,
 * construct, or construct-only) keyed by its camelCase JS name. Read-only
 * properties are intentionally omitted — they cannot be passed to
 * `g_object_new_with_properties` and consumers access them at runtime via
 * the property accessor's GIR-name path.
 *
 * Classes with no GType (rare but possible for abstract bases without
 * `glib:get-type`) are skipped.
 *
 * @param ctx - The module context
 * @param klass - The class to register
 */
export const emitClassConstructionMeta = (ctx: ModuleContext, klass: GirClass): void => {
    if (klass.glibGetType === undefined) return;
    const getTypeRef = renderGetTypeReference(ctx, klass.glibGetType, klass.glibTypeName);
    if (getTypeRef === undefined) return;
    const className = pascalCase(klass.name);
    const props = [...klass.properties, ...collectInterfaceProperties(ctx, klass)].filter(isConstructable);
    const propsLiteral = renderPropsLiteral(ctx, props);
    ctx.addRuntimeImport("registerConstructionMeta");
    const body = `kind: "gobject",\ngtype: ${getTypeRef},\nprops: ${propsLiteral},`;
    ctx.module.appendRegistration(`registerConstructionMeta(${className}, {\n${indent(body, 1)}\n});`);
};

/**
 * Emits `registerConstructionMeta(Class, { kind: "boxed", ... })` for a
 * boxed record declaration.
 *
 * The meta records the struct size, GLib type/library (for the boxed
 * allocator), and per-field byte offsets keyed by camelCase JS name.
 * Vtable records are skipped; plain structs without a GType also skip
 * registration because they cannot be constructed through the meta path.
 *
 * @param ctx - The module context
 * @param boxed - The boxed record to register
 */
export const emitBoxedConstructionMeta = (ctx: ModuleContext, boxed: GirBoxed): void => {
    if (boxed.flavor === "vtable") return;
    if (boxed.glibGetType === undefined && boxed.disguised) return;
    const className = pascalCase(boxed.name);
    const { slots, size } = computeBoxedFieldSlots(ctx, boxed.fields, boxed.isUnion);
    const fieldsLiteral = renderBoxedFieldsLiteral(ctx, slots);
    const lib = ctx.namespace.sharedLibrary;
    const glibTypeName = boxed.glibTypeName ?? boxed.cType;
    const lines: string[] = [`kind: "boxed"`, `size: ${size}`];
    if (glibTypeName !== undefined) lines.push(`glibTypeName: ${quote(glibTypeName)}`);
    if (lib !== undefined) lines.push(`lib: ${quote(lib)}`);
    lines.push(`fields: ${fieldsLiteral}`);
    ctx.addRuntimeImport("registerConstructionMeta");
    ctx.module.appendRegistration(`registerConstructionMeta(${className}, {\n${indent(lines.join(",\n"), 1)},\n});`);
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

const isConstructable = (property: GirProperty): boolean =>
    property.writable || property.construct || property.constructOnly;

const renderPropsLiteral = (ctx: ModuleContext, properties: readonly GirProperty[]): string => {
    if (properties.length === 0) return "{}";
    const entries: string[] = [];
    for (const property of properties) {
        const jsName = property.name.replaceAll("-", "_");
        const ffiType = writeFfiType(ctx, property.type, property.transferOwnership);
        const parts = [`girName: ${quote(property.name)}`, `ffiType: ${ffiType}`];
        if (property.constructOnly) parts.push(`constructOnly: true`);
        entries.push(`${jsName}: { ${parts.join(", ")} }`);
    }
    return `{\n${indent(entries.join(",\n"), 1)},\n}`;
};
