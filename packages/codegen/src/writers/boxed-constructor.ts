import { quote, toCamelCase, toIdentifier } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import { indent } from "../dsl/emit.js";
import type { GirBoxed } from "../gir/boxed.js";
import type { GirField } from "../gir/field.js";
import type { GirTypeRef } from "../gir/type-ref.js";
import { type BoxedFieldSlot, computeBoxedFieldSlots } from "./boxed-layout.js";
import { renderTsType } from "./ts-type.js";
import { renderFfiType } from "./value.js";

/**
 * A boxed field that carries a writable value (private, read-only, callback,
 * and type-less fields are not settable at construction).
 */
type WritableFieldSlot = BoxedFieldSlot & { readonly field: GirField & { readonly type: GirTypeRef } };

const isWritableFieldSlot = (entry: BoxedFieldSlot): entry is WritableFieldSlot =>
    !entry.field.private &&
    entry.field.writable &&
    entry.field.callback === undefined &&
    entry.field.type !== undefined;

const isOpaque = (boxed: GirBoxed): boolean => boxed.glibGetType === undefined && boxed.disguised;

/**
 * Renders the `export interface <Boxed>ConstructorProps` declaration: the
 * camelCase, optional, nullable form of every writable field. Opaque boxed
 * records (disguised, no GType) have no known fields and get an empty bag.
 *
 * @param context - The module context
 * @param boxed - The boxed record
 * @param className - The local PascalCase class name
 */
export const renderBoxedConstructorPropsInterface = (
    context: ModuleContext,
    boxed: GirBoxed,
    className: string,
): string => {
    if (isOpaque(boxed)) return `export interface ${className}ConstructorProps {}`;
    const { slots } = computeBoxedFieldSlots(context, boxed.fields, boxed.isUnion);
    const lines = slots
        .filter(isWritableFieldSlot)
        .map(
            (entry) =>
                `${toIdentifier(toCamelCase(entry.field.name))}?: ${renderTsType(context, entry.field.type, true)};`,
        );
    const body = lines.length === 0 ? "" : `\n${indent(lines.join("\n"), 1)}\n`;
    return `export interface ${className}ConstructorProps {${body}}`;
};

/**
 * Renders a boxed record's constructor.
 *
 * The constructor allocates zero-filled native memory of the struct's size and
 * writes each provided field at its byte offset, threading bitfield members
 * through a read-modify-write into their shared storage word. Opaque records
 * have no known layout, so their constructor throws.
 *
 * @param context - The module context
 * @param boxed - The boxed record
 * @param className - The local PascalCase class name
 */
export const renderBoxedConstructor = (context: ModuleContext, boxed: GirBoxed, className: string): string => {
    if (isOpaque(boxed)) {
        return `constructor() {\n${indent(`throw new Error(${quote(`Cannot construct ${className}: opaque boxed type with no known layout`)});`, 1)}\n}`;
    }
    context.addNativeImport("alloc");
    context.addRuntimeImport("setHandle");
    const { slots, size } = computeBoxedFieldSlots(context, boxed.fields, boxed.isUnion);
    const statements = [`const handle = alloc(${allocArgs(context, boxed, size).join(", ")});`];
    for (const entry of slots) {
        if (!isWritableFieldSlot(entry)) continue;
        statements.push(renderFieldWrite(context, entry));
    }
    statements.push("setHandle(this, handle);");
    const body = statements.join("\n");
    return `constructor(props: ${className}ConstructorProps = {}) {\n${indent(body, 1)}\n}`;
};

const allocArgs = (context: ModuleContext, boxed: GirBoxed, size: number): readonly string[] => {
    const glibTypeName = boxed.glibTypeName ?? boxed.cType;
    const lib = context.namespace.sharedLibrary;
    const args = [String(size)];
    if (glibTypeName !== undefined || lib !== undefined) {
        args.push(glibTypeName !== undefined ? quote(glibTypeName) : "undefined");
    }
    if (lib !== undefined) args.push(quote(lib));
    return args;
};

const renderFieldWrite = (context: ModuleContext, entry: WritableFieldSlot): string => {
    context.addRuntimeImport("t");
    context.addNativeImport("write");
    const ffiType = renderFfiType(context, entry.field.type, "none");
    const name = toIdentifier(toCamelCase(entry.field.name));
    const offset = entry.slot.byteOffset;
    if (entry.slot.bitWidth === undefined) {
        return `if (props.${name} !== undefined) write(handle, ${ffiType}, ${offset}, props.${name});`;
    }
    context.addNativeImport("read");
    const mask = (1 << entry.slot.bitWidth) - 1;
    const bitOffset = entry.slot.bitOffset ?? 0;
    const merged = `(((read(handle, ${ffiType}, ${offset}) as number) & ~(${mask} << ${bitOffset})) | ((Number(props.${name}) & ${mask}) << ${bitOffset})) >>> 0`;
    return `if (props.${name} !== undefined) write(handle, ${ffiType}, ${offset}, ${merged});`;
};
