import { sourceStringLiteral, toCamelIdentifier } from "@gtkx/utils";
import type { GirField } from "../../gir/field.js";
import type { GirRecord } from "../../gir/record.js";
import type { TypeId } from "../../gir/type-id.js";
import type { ModuleContext } from "../../writer/context.js";
import { renderDescriptor } from "../../analysis/descriptor-render.js";
import { renderTsType } from "../../analysis/ts-type.js";
import { renderBlock, renderBracedOrEmpty } from "../../writer/emit.js";
import { renderSourceGtype } from "./gtype-binding.js";
import { emitFieldWrite, isEmittableField, isInlineField } from "./record-field-accessor.js";
import { computeRecordFieldSlots, type RecordFieldSlot } from "./record-layout.js";
import { isConstructibleRecord } from "./value-marshalable.js";

type WritableFieldSlot = RecordFieldSlot & { field: GirField & { type: TypeId } };

const isWritableFieldSlot = (context: ModuleContext, entry: RecordFieldSlot): entry is WritableFieldSlot =>
    entry.field.writable && isEmittableField(context, entry.field);

const isOpaque = (record: GirRecord): boolean => record.opaque || record.disguised;

const renderRecordConstructorPropsInterface = (
    context: ModuleContext,
    record: GirRecord,
    className: string,
): string => {
    const head = `export interface ${className}ConstructorProps`;

    if (isOpaque(record) || !isConstructibleRecord(context, context.namespace.name, record)) {
        return renderBracedOrEmpty(head, "");
    }

    const { slots } = computeRecordFieldSlots(context, record.fields, record.isUnion);

    const lines = slots
        .filter((entry): entry is WritableFieldSlot => isWritableFieldSlot(context, entry))
        .map((entry) => `${toCamelIdentifier(entry.field.name)}?: ${renderTsType(context, entry.field.type, true)};`);

    return renderBracedOrEmpty(head, lines.join("\n"));
};

const renderOpaqueConstructor = (className: string, superCall: string[]): string => {
    const message = sourceStringLiteral(`Cannot construct ${className}: opaque boxed type with no known layout`);

    return renderBlock("constructor()", [...superCall, `throw new globalThis.Error(${message});`].join("\n"));
};

const renderEmptyConstructor = (className: string, isErrorSubclass: boolean): string =>
    isErrorSubclass
        ? renderBlock(`constructor(props: ${className}ConstructorProps = {})`, "super();")
        : `constructor(props: ${className}ConstructorProps = {}) {}`;

const renderFieldWrites = (context: ModuleContext, slots: RecordFieldSlot[]): string[] => {
    const statements: string[] = [];

    for (const entry of slots) {
        if (isWritableFieldSlot(context, entry)) {
            statements.push(renderFieldWrite(context, entry));
        }
    }

    return statements;
};

const renderRecordConstructor = (
    context: ModuleContext,
    record: GirRecord,
    className: string,
    isErrorSubclass = false,
): string => {
    const superCall = isErrorSubclass ? ["super();"] : [];

    if (isOpaque(record) || !isConstructibleRecord(context, context.namespace.name, record)) {
        return renderOpaqueConstructor(className, superCall);
    }

    const { slots, size } = computeRecordFieldSlots(context, record.fields, record.isUnion);

    if (size === 0) {
        return renderEmptyConstructor(className, isErrorSubclass);
    }

    context.addRuntimeImport("alloc");
    context.addRuntimeImport("setHandle");

    const statements = [
        ...superCall,
        `const handle = alloc(${allocArgs(context, record, size).join(", ")});`,
        ...renderFieldWrites(context, slots),
        "setHandle(this, handle);",
    ];

    return renderBlock(`constructor(props: ${className}ConstructorProps = {})`, statements.join("\n"));
};

const allocArgs = (context: ModuleContext, record: GirRecord, size: number): string[] => {
    const args = [String(size)];

    if (renderSourceGtype(context, record) !== undefined) {
        args.push("this.__type__");
    }

    return args;
};

const renderFieldWrite = (context: ModuleContext, entry: WritableFieldSlot): string => {
    context.addRuntimeImport("t");

    const descriptor = context.hoistDescriptor(
        renderDescriptor(context, entry.field.type, "none", { isInline: isInlineField(context, entry.field) }),
    );

    const name = toCamelIdentifier(entry.field.name);

    const write = emitFieldWrite(context, {
        descriptor,
        slot: entry.slot,
        targetExpr: "handle",
        valueExpr: `props.${name}`,
    });

    return `if (props.${name} !== undefined) ${write}`;
};

export { renderRecordConstructorPropsInterface, renderRecordConstructor };
