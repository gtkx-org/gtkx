import { sourceStringLiteral, toCamelIdentifier } from "@gtkx/utils";
import { renderDescriptor } from "../../analysis/descriptor-render.js";
import { renderTsType } from "../../analysis/ts-type.js";
import type { GirField } from "../../gir/field.js";
import type { GirRecord } from "../../gir/record.js";
import type { TypeId } from "../../gir/type-id.js";
import type { ModuleContext } from "../../writer/context.js";
import { renderBlock, renderBracedOrEmpty } from "../../writer/emit.js";
import { emitFieldWrite, isEmittableField } from "./record-field-accessor.js";
import { computeRecordFieldSlots, type RecordFieldSlot } from "./record-layout.js";

type WritableFieldSlot = RecordFieldSlot & { field: GirField & { type: TypeId } };

const isWritableFieldSlot = (context: ModuleContext, entry: RecordFieldSlot): entry is WritableFieldSlot =>
    entry.field.writable && isEmittableField(context, entry.field);

const isOpaque = (record: GirRecord): boolean => record.glibGetType === undefined && record.disguised;

export const renderRecordConstructorPropsInterface = (
    context: ModuleContext,
    record: GirRecord,
    className: string,
): string => {
    const head = `export interface ${className}ConstructorProps`;
    if (isOpaque(record)) return renderBracedOrEmpty(head, "");
    const { slots } = computeRecordFieldSlots(context, record.fields, record.isUnion);
    const lines = slots
        .filter((entry): entry is WritableFieldSlot => isWritableFieldSlot(context, entry))
        .map((entry) => `${toCamelIdentifier(entry.field.name)}?: ${renderTsType(context, entry.field.type, true)};`);
    return renderBracedOrEmpty(head, lines.join("\n"));
};

export const renderRecordConstructor = (
    context: ModuleContext,
    record: GirRecord,
    className: string,
    extendsError = false,
): string => {
    const superCall = extendsError ? ["super();"] : [];
    if (isOpaque(record)) {
        return renderBlock(
            `constructor()`,
            [
                ...superCall,
                `throw new globalThis.Error(${sourceStringLiteral(`Cannot construct ${className}: opaque boxed type with no known layout`)});`,
            ].join("\n"),
        );
    }
    const { slots, size } = computeRecordFieldSlots(context, record.fields, record.isUnion);
    if (size === 0) {
        return extendsError
            ? renderBlock(`constructor(props: ${className}ConstructorProps = {})`, "super();")
            : `constructor(props: ${className}ConstructorProps = {}) {}`;
    }
    context.addRuntimeImport("alloc");
    context.addRuntimeImport("setHandle");
    const statements = [...superCall, `const handle = alloc(${allocArgs(record, size).join(", ")});`];
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
    const descriptor = context.hoistDescriptor(renderDescriptor(context, entry.field.type, "none"));
    const name = toCamelIdentifier(entry.field.name);
    const write = emitFieldWrite(context, {
        descriptor,
        slot: entry.slot,
        targetExpr: "handle",
        valueExpr: `props.${name}`,
    });
    return `if (props.${name} !== undefined) ${write}`;
};
