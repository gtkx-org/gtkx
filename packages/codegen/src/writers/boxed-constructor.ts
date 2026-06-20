import { quote, toCamelIdentifier } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import { indent, renderBlock } from "../dsl/emit.js";
import type { GirBoxed } from "../gir/boxed.js";
import type { GirField } from "../gir/field.js";
import type { TypeId } from "../gir/type-id.js";
import { bitMask, mergeBitfield } from "./bitfield.js";
import { type BoxedFieldSlot, computeBoxedFieldSlots } from "./boxed-layout.js";
import { typeRefIsClassStruct } from "./class-struct-record.js";
import { renderTsType } from "./ts-type.js";
import { isInlineCallbackRef, renderFfiType } from "./value.js";

type WritableFieldSlot = BoxedFieldSlot & { field: GirField & { type: TypeId } };

const isWritableFieldSlot = (context: ModuleContext, entry: BoxedFieldSlot): entry is WritableFieldSlot =>
    !entry.field.private &&
    entry.field.writable &&
    entry.field.type !== undefined &&
    !isInlineCallbackRef(context.repository, entry.field.type) &&
    !typeRefIsClassStruct(context, entry.field.type);

const isOpaque = (boxed: GirBoxed): boolean => boxed.glibGetType === undefined && boxed.disguised;

export const renderBoxedConstructorPropsInterface = (
    context: ModuleContext,
    boxed: GirBoxed,
    className: string,
): string => {
    if (isOpaque(boxed)) return `export interface ${className}ConstructorProps {}`;
    const { slots } = computeBoxedFieldSlots(context, boxed.fields, boxed.isUnion);
    const lines = slots
        .filter((entry): entry is WritableFieldSlot => isWritableFieldSlot(context, entry))
        .map((entry) => `${toCamelIdentifier(entry.field.name)}?: ${renderTsType(context, entry.field.type, true)};`);
    const body = lines.length === 0 ? "" : `\n${indent(lines.join("\n"), 1)}\n`;
    return `export interface ${className}ConstructorProps {${body}}`;
};

export const renderBoxedConstructor = (context: ModuleContext, boxed: GirBoxed, className: string): string => {
    if (isOpaque(boxed)) {
        return renderBlock(
            `constructor()`,
            `throw new Error(${quote(`Cannot construct ${className}: opaque boxed type with no known layout`)});`,
        );
    }
    const { slots, size } = computeBoxedFieldSlots(context, boxed.fields, boxed.isUnion);
    if (size === 0) {
        return `constructor(props: ${className}ConstructorProps = {}) {}`;
    }
    context.addNativeImport("alloc");
    context.addRuntimeImport("setHandle");
    const statements = [`const handle = alloc(${allocArgs(boxed, size).join(", ")});`];
    for (const entry of slots) {
        if (!isWritableFieldSlot(context, entry)) continue;
        statements.push(renderFieldWrite(context, entry));
    }
    statements.push("setHandle(this, handle);");
    const body = statements.join("\n");
    return renderBlock(`constructor(props: ${className}ConstructorProps = {})`, body);
};

const allocArgs = (boxed: GirBoxed, size: number): string[] => {
    const glibTypeName = boxed.glibTypeName ?? boxed.cType;
    const args = [String(size)];
    if (glibTypeName !== undefined) {
        args.push(quote(glibTypeName));
    }
    return args;
};

const renderFieldWrite = (context: ModuleContext, entry: WritableFieldSlot): string => {
    context.addRuntimeImport("t");
    context.addNativeImport("write");
    const ffiType = renderFfiType(context, entry.field.type, "none");
    const name = toCamelIdentifier(entry.field.name);
    const offset = entry.slot.byteOffset;
    if (entry.slot.bitWidth === undefined) {
        return `if (props.${name} !== undefined) write(handle, ${ffiType}, ${offset}, props.${name});`;
    }
    context.addNativeImport("read");
    const mask = bitMask(entry.slot.bitWidth);
    const bitOffset = entry.slot.bitOffset ?? 0;
    const merged = mergeBitfield(`(read(handle, ${ffiType}, ${offset}) as number)`, `props.${name}`, mask, bitOffset);
    return `if (props.${name} !== undefined) write(handle, ${ffiType}, ${offset}, ${merged});`;
};
