import { toCamelIdentifier } from "@gtkx/utils";
import { tStruct } from "../../analysis/descriptor.js";
import { isInlineCallbackRef, renderDescriptor } from "../../analysis/descriptor-render.js";
import { renderTsType } from "../../analysis/ts-type.js";
import type { GirField } from "../../gir/field.js";
import type { FieldSlot } from "../../gir/size.js";
import type { GirType } from "../../gir/type.js";
import type { TypeId } from "../../gir/type-id.js";
import type { ModuleContext } from "../../writer/context.js";
import { renderJsDoc } from "../../writer/doc.js";
import { indent, renderBlock } from "../../writer/emit.js";
import { refIsClassStruct } from "./class-struct-record.js";
import { bitMask, computeRecordFieldSlots, mergeBitfield, type RecordFieldSlot } from "./record-layout.js";
import { wrapReturnValue } from "./return-wrap.js";

export const isEmittableField = (context: ModuleContext, field: GirField): field is GirField & { type: TypeId } =>
    !field.private &&
    field.type !== undefined &&
    !isInlineCallbackRef(context.library, field.type) &&
    !refIsClassStruct(context, field.type);

type FieldWriteSpec = {
    descriptor: string;
    slot: FieldSlot;
    targetExpr: string;
    valueExpr: string;
};

export const emitFieldWrite = (context: ModuleContext, spec: FieldWriteSpec): string => {
    const { descriptor, slot, targetExpr, valueExpr } = spec;
    context.addRuntimeImport("write");
    if (slot.bitWidth === undefined) {
        return `write(${targetExpr}, ${descriptor}, ${slot.byteOffset}, ${valueExpr});`;
    }
    context.addRuntimeImport("read");
    const merged = mergeBitfield(
        `(read(${targetExpr}, ${descriptor}, ${slot.byteOffset}) as number)`,
        valueExpr,
        bitMask(slot.bitWidth),
        slot.bitOffset ?? 0,
    );
    return `write(${targetExpr}, ${descriptor}, ${slot.byteOffset}, ${merged});`;
};

type AdmittedField = {
    field: GirField & { type: TypeId };
    jsName: string;
};

const admitField = (
    context: ModuleContext,
    slot: RecordFieldSlot,
    claimedNames: Set<string>,
): AdmittedField | undefined => {
    const { field } = slot;
    if (!field.readable && !field.writable) return undefined;
    if (!isEmittableField(context, field)) return undefined;
    const jsName = toCamelIdentifier(field.name);
    if (claimedNames.has(jsName)) return undefined;
    if (jsName === "constructor") return undefined;
    return { field, jsName };
};

export type RecordFieldEntry = {
    jsName: string;
    tsType: string;
    writable: boolean;
    doc: string | undefined;
};

export const resolveRecordFieldEntry = (
    context: ModuleContext,
    slot: RecordFieldSlot,
    claimedNames: Set<string>,
): RecordFieldEntry | undefined => {
    const admitted = admitField(context, slot, claimedNames);
    if (admitted === undefined) return undefined;
    return {
        jsName: admitted.jsName,
        tsType: renderTsType(context, admitted.field.type, false),
        writable: admitted.field.writable,
        doc: admitted.field.doc,
    };
};

export const renderRecordFieldAccessor = (
    context: ModuleContext,
    slot: RecordFieldSlot,
    claimedNames: Set<string>,
    siblingFields: GirField[],
): string | undefined => {
    const admitted = admitField(context, slot, claimedNames);
    if (admitted === undefined) return undefined;
    const { field, jsName } = admitted;
    const doc = renderJsDoc(field.doc);

    const structArray = renderStructArrayAccessor(context, { field, jsName, slot: slot.slot, siblingFields });
    if (structArray !== undefined) return `${doc}${structArray}`;

    if (!isAccessorEligibleType(context, field.type)) {
        const tsType = renderTsType(context, field.type, false);
        return `${doc}declare ${jsName}: ${tsType};`;
    }

    const descriptor = context.hoistDescriptor(renderDescriptor(context, field.type, "none"));
    const tsType = renderTsType(context, field.type, false);
    const accessorOptions: AccessorOptions = {
        context,
        jsName,
        tsType,
        descriptor,
        slot: slot.slot,
        fieldType: field.type,
    };
    const blocks: string[] = [getterBlock(accessorOptions)];
    if (field.writable) {
        blocks.push(setterBlock(accessorOptions));
    }
    return `${doc}${blocks.join("\n\n")}`;
};

const isAccessorEligibleType = (context: ModuleContext, ref: TypeId): boolean => {
    const type = context.library.typeOf(ref);
    if (type === undefined) return true;
    switch (type.kind) {
        case "primitive":
            return type.category !== "void" && type.category !== "unichar";
        case "class":
        case "interface":
        case "record":
        case "enum":
        case "alias":
            return true;
        case "callback":
            return context.library.nameOf(ref) !== undefined;
        case "carray":
            return type.fixedSize !== undefined;
        case "list":
        case "hashtable":
        case "varargs":
            return false;
    }
};

const resolveInlineStructFields = (
    context: ModuleContext,
    ref: TypeId | undefined,
    occurrenceCType: string | undefined,
): GirField[] | undefined => {
    if (ref === undefined) return undefined;
    if (occurrenceCType?.endsWith("*") === true) return undefined;
    const type = context.library.typeOf(ref);
    if (type?.kind !== "record") return undefined;
    if (type.value.cType?.endsWith("*") === true) return undefined;
    if (type.value.fields.length === 0) return undefined;
    return type.value.fields;
};

const arrayLengthExpression = (
    arrayRef: Extract<GirType, { kind: "carray" }>,
    siblingFields: GirField[],
): string | undefined => {
    if (arrayRef.fixedSize !== undefined) return String(arrayRef.fixedSize);
    if (arrayRef.lengthParameterIndex === undefined) return undefined;
    const lengthField = siblingFields.filter((field) => !field.private)[arrayRef.lengthParameterIndex];
    if (lengthField === undefined) return undefined;
    return `this.${toCamelIdentifier(lengthField.name)}`;
};

type InlineFieldVisit = {
    jsName: string;
    descriptor: string;
    offset: number;
    slot: FieldSlot;
    type: TypeId;
};

type InlineFieldVisitors = {
    leaf: (visit: InlineFieldVisit) => void;
    nested: (jsName: string, nested: GirField[], offset: number) => void;
};

const visitInlineStructFields = (
    context: ModuleContext,
    fields: GirField[],
    baseOffset: number,
    visitors: InlineFieldVisitors,
): void => {
    const { slots } = computeRecordFieldSlots(context, fields);
    for (const { field, slot } of slots) {
        if (field.private || field.type === undefined || isInlineCallbackRef(context.library, field.type)) {
            continue;
        }
        const jsName = toCamelIdentifier(field.name);
        const offset = baseOffset + slot.byteOffset;
        const nested = resolveInlineStructFields(context, field.type, field.cType);
        if (nested !== undefined) {
            visitors.nested(jsName, nested, offset);
            continue;
        }
        if (!isAccessorEligibleType(context, field.type)) continue;
        const descriptor = context.hoistDescriptor(renderDescriptor(context, field.type, "none"));
        visitors.leaf({ jsName, descriptor, offset, slot, type: field.type });
    }
};

const renderElementReadObject = (context: ModuleContext, fields: GirField[], baseOffset: number): string => {
    const entries: string[] = [];
    visitInlineStructFields(context, fields, baseOffset, {
        leaf: ({ jsName, descriptor, offset, slot, type }) => {
            if (slot.bitWidth === undefined) {
                entries.push(
                    `${jsName}: read(__array, ${descriptor}, __base + ${offset}) as ${renderTsType(context, type, false)}`,
                );
                return;
            }
            const shift = slot.bitOffset ?? 0;
            entries.push(
                `${jsName}: (((read(__array, ${descriptor}, __base + ${offset}) as number) >>> ${shift}) & ${bitMask(slot.bitWidth)})`,
            );
        },
        nested: (jsName, nested, offset) => {
            entries.push(`${jsName}: ${renderElementReadObject(context, nested, offset)}`);
        },
    });
    return `{ ${entries.join(", ")} }`;
};

type ElementWriteOptions = {
    fields: GirField[];
    baseOffset: number;
    valuePath: string;
    out: string[];
};

const appendElementWriteStatements = (context: ModuleContext, options: ElementWriteOptions): void => {
    const { fields, baseOffset, valuePath, out } = options;
    visitInlineStructFields(context, fields, baseOffset, {
        leaf: ({ jsName, descriptor, offset, slot }) => {
            const valueExpr = `${valuePath}.${jsName}`;
            if (slot.bitWidth === undefined) {
                out.push(`write(__array, ${descriptor}, __base + ${offset}, ${valueExpr});`);
                return;
            }
            const mask = bitMask(slot.bitWidth);
            const shift = slot.bitOffset ?? 0;
            const merged = mergeBitfield(
                `(read(__array, ${descriptor}, __base + ${offset}) as number)`,
                valueExpr,
                mask,
                shift,
            );
            out.push(`write(__array, ${descriptor}, __base + ${offset}, ${merged});`);
        },
        nested: (jsName, nested, offset) => {
            appendElementWriteStatements(context, {
                fields: nested,
                baseOffset: offset,
                valuePath: `${valuePath}.${jsName}`,
                out,
            });
        },
    });
};

type StructArrayTarget = {
    field: GirField;
    jsName: string;
    slot: FieldSlot;
    siblingFields: GirField[];
};

type StructArrayAccessorOptions = {
    context: ModuleContext;
    jsName: string;
    tsType: string;
    elementDescriptor: string;
    offset: number;
    lengthExpr: string;
    elementSize: number;
    elementFields: GirField[];
};

const structArrayGetterBlock = (options: StructArrayAccessorOptions): string => {
    const { context, jsName, tsType, elementDescriptor, offset, lengthExpr, elementSize, elementFields } = options;
    const element = renderElementReadObject(context, elementFields, 0);
    const loop = [`const __base = __index * ${elementSize};`, `__result.push(${element});`].join("\n");
    const body = [
        `const __array = read(getHandle(this), ${elementDescriptor}, ${offset}) as ReturnType<typeof getHandle>;`,
        `const __result: ${tsType} = [];`,
        `for (let __index = 0; __index < ${lengthExpr}; __index++) {`,
        indent(loop, 1),
        "}",
        "return __result;",
    ].join("\n");
    return renderBlock(`get ${jsName}(): ${tsType}`, body);
};

const structArraySetterBlock = (options: StructArrayAccessorOptions): string => {
    const { context, jsName, tsType, elementDescriptor, offset, elementSize, elementFields } = options;
    const writes: string[] = [];
    appendElementWriteStatements(context, {
        fields: elementFields,
        baseOffset: 0,
        valuePath: "__element",
        out: writes,
    });
    const loop = [`const __base = __index * ${elementSize};`, ...writes].join("\n");
    const body = [
        `const __descriptor = ${elementDescriptor};`,
        `const __array = read(getHandle(this), __descriptor, ${offset}) as ReturnType<typeof getHandle>;`,
        `for (const [__index, __element] of __value.entries()) {`,
        indent(loop, 1),
        "}",
        `write(getHandle(this), __descriptor, ${offset}, __array);`,
    ].join("\n");
    return renderBlock(`set ${jsName}(__value: ${tsType})`, body);
};

const renderStructArrayAccessor = (context: ModuleContext, target: StructArrayTarget): string | undefined => {
    const { field, jsName, slot, siblingFields } = target;
    if (field.type === undefined || slot.bitWidth !== undefined) return undefined;
    const arrayType = context.library.typeOf(field.type);
    if (arrayType?.kind !== "carray") return undefined;
    const elementType = context.library.typeOf(arrayType.element);
    if (elementType?.kind === "record" && elementType.value.glibGetType !== undefined) return undefined;
    const elementFields = resolveInlineStructFields(context, arrayType.element, arrayType.elementCType);
    if (elementFields === undefined) return undefined;
    const lengthExpr = arrayLengthExpression(arrayType, siblingFields);
    if (lengthExpr === undefined) return undefined;
    const elementSize = computeRecordFieldSlots(context, elementFields).size;
    if (elementSize === 0) return undefined;

    context.addRuntimeImport("read");
    context.addRuntimeImport("getHandle");
    context.addRuntimeImport("t");
    const options: StructArrayAccessorOptions = {
        context,
        jsName,
        tsType: renderTsType(context, field.type, false),
        elementDescriptor: tStruct("borrowed", {
            size: `${lengthExpr} * ${elementSize}`,
            wrapperClass: undefined,
            callerAllocated: false,
        }),
        offset: slot.byteOffset,
        lengthExpr,
        elementSize,
        elementFields,
    };
    const blocks: string[] = [];
    if (field.readable) blocks.push(structArrayGetterBlock(options));
    if (field.writable) {
        context.addRuntimeImport("write");
        blocks.push(structArraySetterBlock(options));
    }
    return blocks.length === 0 ? undefined : blocks.join("\n\n");
};

type AccessorOptions = {
    context: ModuleContext;
    jsName: string;
    tsType: string;
    descriptor: string;
    slot: FieldSlot;
    fieldType: TypeId;
};

const getterBlock = (options: AccessorOptions): string => {
    const { context, jsName, tsType, descriptor, slot, fieldType } = options;
    context.addRuntimeImport("read");
    context.addRuntimeImport("getHandle");
    if (slot.bitWidth === undefined) {
        const valueExpression = `read(getHandle(this), ${descriptor}, ${slot.byteOffset})`;
        const wrapped = wrapReturnValue(context, {
            ref: fieldType,
            nullable: false,
            valueExpression,
        });
        const body = `return ${wrapped};`;
        return renderBlock(`get ${jsName}(): ${tsType}`, body);
    }
    const mask = bitMask(slot.bitWidth);
    const shift = slot.bitOffset ?? 0;
    const body = `const __unit = read(getHandle(this), ${descriptor}, ${slot.byteOffset}) as number;\nreturn (((__unit >>> ${shift}) & ${mask}) >>> 0) as ${tsType};`;
    return renderBlock(`get ${jsName}(): ${tsType}`, body);
};

const setterBlock = (options: AccessorOptions): string => {
    const { context, jsName, tsType, descriptor, slot } = options;
    context.addRuntimeImport("getHandle");
    const body = emitFieldWrite(context, { descriptor, slot, targetExpr: "getHandle(this)", valueExpr: "value" });
    return renderBlock(`set ${jsName}(value: ${tsType})`, body);
};
