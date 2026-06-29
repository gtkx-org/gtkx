import { sourceStringLiteral, toCamelIdentifier } from "@gtkx/utils";
import { isInlineCallbackRef, renderDescriptor } from "../../analysis/descriptor-render.js";
import { renderTsType } from "../../analysis/ts-type.js";
import type { GirField } from "../../gir/field.js";
import type { GirRecord } from "../../gir/record.js";
import type { TypeId } from "../../gir/type-id.js";
import type { ModuleContext } from "../../writer/context.js";
import { indent, renderBlock } from "../../writer/emit.js";
import { bitMask, mergeBitfield } from "./bitfield.js";
import { refIsClassStruct } from "./class-struct-record.js";
import { computeRecordFieldSlots, type RecordFieldSlot } from "./record-layout.js";

type WritableFieldSlot = RecordFieldSlot & { field: GirField & { type: TypeId } };

const isWritableFieldSlot = (context: ModuleContext, entry: RecordFieldSlot): entry is WritableFieldSlot =>
    !entry.field.private &&
    entry.field.writable &&
    entry.field.type !== undefined &&
    !isInlineCallbackRef(context.library, entry.field.type) &&
    !refIsClassStruct(context, entry.field.type);

const isOpaque = (record: GirRecord): boolean => record.glibGetType === undefined && record.disguised;

export const renderRecordConstructorPropsInterface = (
    context: ModuleContext,
    record: GirRecord,
    className: string,
): string => {
    if (isOpaque(record)) return `export interface ${className}ConstructorProps {}`;
    const { slots } = computeRecordFieldSlots(context, record.fields, record.isUnion);
    const lines = slots
        .filter((entry): entry is WritableFieldSlot => isWritableFieldSlot(context, entry))
        .map((entry) => `${toCamelIdentifier(entry.field.name)}?: ${renderTsType(context, entry.field.type, true)};`);
    const body = lines.length === 0 ? "" : `\n${indent(lines.join("\n"), 1)}\n`;
    return `export interface ${className}ConstructorProps {${body}}`;
};

export const renderRecordConstructor = (context: ModuleContext, record: GirRecord, className: string): string => {
    if (isOpaque(record)) {
        return renderBlock(
            `constructor()`,
            `throw new Error(${sourceStringLiteral(`Cannot construct ${className}: opaque boxed type with no known layout`)});`,
        );
    }
    const { slots, size } = computeRecordFieldSlots(context, record.fields, record.isUnion);
    if (size === 0) {
        return `constructor(props: ${className}ConstructorProps = {}) {}`;
    }
    context.addNativeImport("alloc");
    context.addRuntimeImport("setHandle");
    const statements = [`const handle = alloc(${allocArgs(record, size).join(", ")});`];
    for (const entry of slots) {
        if (!isWritableFieldSlot(context, entry)) continue;
        statements.push(renderFieldWrite(context, entry));
    }
    statements.push("setHandle(this, handle);");
    const body = statements.join("\n");
    return renderBlock(`constructor(props: ${className}ConstructorProps = {})`, body);
};

const allocArgs = (record: GirRecord, size: number): string[] => {
    const glibTypeName = record.glibTypeName ?? record.cType;
    const args = [String(size)];
    if (glibTypeName !== undefined) {
        args.push(sourceStringLiteral(glibTypeName));
    }
    return args;
};

const renderFieldWrite = (context: ModuleContext, entry: WritableFieldSlot): string => {
    context.addRuntimeImport("t");
    context.addNativeImport("write");
    const descriptor = renderDescriptor(context, entry.field.type, "none");
    const name = toCamelIdentifier(entry.field.name);
    const offset = entry.slot.byteOffset;
    if (entry.slot.bitWidth === undefined) {
        return `if (props.${name} !== undefined) write(handle, ${descriptor}, ${offset}, props.${name});`;
    }
    context.addNativeImport("read");
    const mask = bitMask(entry.slot.bitWidth);
    const bitOffset = entry.slot.bitOffset ?? 0;
    const merged = mergeBitfield(
        `(read(handle, ${descriptor}, ${offset}) as number)`,
        `props.${name}`,
        mask,
        bitOffset,
    );
    return `if (props.${name} !== undefined) write(handle, ${descriptor}, ${offset}, ${merged});`;
};
