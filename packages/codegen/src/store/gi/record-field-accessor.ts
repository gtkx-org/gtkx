import { toCamelIdentifier } from "@gtkx/utils";
import type { GirAnnotations } from "../../gir/annotations.js";
import type { GirField } from "../../gir/field.js";
import type { GirRecord } from "../../gir/record.js";
import type { FieldSlot } from "../../gir/size.js";
import type { TypeId } from "../../gir/type-id.js";
import type { GirType } from "../../gir/type.js";
import type { ModuleContext } from "../../writer/context.js";
import { isInlineCallbackRef, renderDescriptor } from "../../analysis/descriptor-render.js";
import { tStruct } from "../../analysis/descriptor.js";
import { renderTsType } from "../../analysis/ts-type.js";
import { indent, renderBlock } from "../../writer/emit.js";
import { getDoc } from "./doc-spec.js";
import { bitMask, computeRecordFieldSlots, mergeBitfield, type RecordFieldSlot } from "./record-layout.js";
import { wrapReturnValue } from "./return-wrap.js";
import { isValueMarshalable } from "./value-marshalable.js";

type FieldWriteSpec = {
    descriptor: string;
    slot: FieldSlot;
    targetExpr: string;
    valueExpr: string;
};

type AdmittedField = {
    field: GirField & { type: TypeId };
    jsName: string;
};

type RecordFieldEntry = {
    jsName: string;
    tsType: string;
    isWritable: boolean;
    doc: string | undefined;
    annotations: GirAnnotations;
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

type ElementWriteOptions = {
    fields: GirField[];
    baseOffset: number;
    valuePath: string;
    out: string[];
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

type StructArrayResolution = {
    fieldType: TypeId;
    elementFields: GirField[];
    lengthExpr: string;
    elementSize: number;
};

type StructArrayElements = {
    arrayType: Extract<GirType, { kind: "carray" }>;
    elementFields: GirField[];
};

type AccessorOptions = {
    context: ModuleContext;
    jsName: string;
    tsType: string;
    descriptor: string;
    slot: FieldSlot;
    fieldType: TypeId;
};

const isMarshalableField = (context: ModuleContext, field: GirField): boolean => {
    if (field.cType?.endsWith("*") === true) {
        return true;
    }

    const type = field.type === undefined ? undefined : context.library.typeFor(field.type);

    if (type?.kind !== "record") {
        return true;
    }

    return isValueMarshalable(context, type.namespace.name, type.value);
};

const isEmittableField = (context: ModuleContext, field: GirField): field is GirField & { type: TypeId } =>
    !field.private &&
    field.type !== undefined &&
    !isInlineCallbackRef(context.library, field.type) &&
    isMarshalableField(context, field);

const emitFieldWrite = (context: ModuleContext, spec: FieldWriteSpec): string => {
    const { descriptor, slot, targetExpr, valueExpr } = spec;
    context.addRuntimeImport("write");

    if (slot.bitWidth === undefined) {
        context.addRuntimeImport("toNative");

        return (
            `write(${targetExpr}, ${descriptor}, ${String(slot.byteOffset)}, ` +
            `toNative(${descriptor}, ${valueExpr}));`
        );
    }

    context.addRuntimeImport("read");

    const merged = mergeBitfield(
        `(read(${targetExpr}, ${descriptor}, ${String(slot.byteOffset)}) as number)`,
        valueExpr,
        bitMask(slot.bitWidth),
        slot.bitOffset ?? 0,
    );

    return `write(${targetExpr}, ${descriptor}, ${String(slot.byteOffset)}, ${merged});`;
};

const admitField = (
    context: ModuleContext,
    slot: RecordFieldSlot,
    claimedNames: Set<string>,
): AdmittedField | undefined => {
    const { field } = slot;

    if (!field.readable && !field.writable) {
        return undefined;
    }

    if (!isEmittableField(context, field)) {
        return undefined;
    }

    const jsName = toCamelIdentifier(field.name);

    if (claimedNames.has(jsName)) {
        return undefined;
    }

    if (jsName === "constructor") {
        return undefined;
    }

    return { field, jsName };
};

const resolveRecordFieldEntry = (
    context: ModuleContext,
    slot: RecordFieldSlot,
    claimedNames: Set<string>,
): RecordFieldEntry | undefined => {
    const admitted = admitField(context, slot, claimedNames);

    if (admitted === undefined) {
        return undefined;
    }

    return {
        jsName: admitted.jsName,
        tsType: renderTsType(context, admitted.field.type, false),
        isWritable: admitted.field.writable,
        doc: admitted.field.doc,
        annotations: admitted.field.annotations,
    };
};

const renderRecordFieldAccessor = (
    context: ModuleContext,
    slot: RecordFieldSlot,
    claimedNames: Set<string>,
    siblingFields: GirField[],
): string | undefined => {
    const admitted = admitField(context, slot, claimedNames);

    if (admitted === undefined) {
        return undefined;
    }

    const { field, jsName } = admitted;
    const doc = getDoc(field);
    const structArray = renderStructArrayAccessor(context, { field, jsName, slot: slot.slot, siblingFields });

    if (structArray !== undefined) {
        return `${doc}${structArray}`;
    }

    if (!isAccessorEligibleType(context, field.type)) {
        const tsType = renderTsType(context, field.type, false);

        return `${doc}declare ${jsName}: ${tsType};`;
    }

    const descriptor = context.hoistDescriptor(
        renderDescriptor(context, field.type, "none", { isInline: isInlineField(context, field) }),
    );

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
    const type = context.library.typeFor(ref);

    if (type === undefined) {
        return true;
    }

    switch (type.kind) {
        case "primitive": {
            return type.category !== "void" && type.category !== "unichar";
        }
        case "class":
        case "interface":
        case "record":
        case "enum":
        case "alias": {
            return true;
        }
        case "callback": {
            return context.library.nameFor(ref) !== undefined;
        }
        case "carray": {
            return type.fixedSize !== undefined;
        }
        case "list":
        case "hashtable":
        case "varargs": {
            return false;
        }
    }
};

const isInlineField = (context: ModuleContext, field: GirField): boolean =>
    field.type !== undefined && resolveInlineStructFields(context, field.type, field.cType) !== undefined;

const resolveInlineStructFields = (
    context: ModuleContext,
    ref: TypeId | undefined,
    occurrenceCType: string | undefined,
): GirField[] | undefined => {
    if (ref === undefined) {
        return undefined;
    }

    if (occurrenceCType?.endsWith("*") === true) {
        return undefined;
    }

    const type = context.library.typeFor(ref);

    if (type?.kind !== "record") {
        return undefined;
    }

    if (type.value.cType?.endsWith("*") === true) {
        return undefined;
    }

    if (type.value.fields.length === 0) {
        return undefined;
    }

    return type.value.fields;
};

const arrayLengthExpression = (
    arrayRef: Extract<GirType, { kind: "carray" }>,
    siblingFields: GirField[],
): string | undefined => {
    if (arrayRef.fixedSize !== undefined) {
        return String(arrayRef.fixedSize);
    }

    if (arrayRef.lengthParameterIndex === undefined) {
        return undefined;
    }

    const lengthField = siblingFields.filter((field) => !field.private)[arrayRef.lengthParameterIndex];

    if (lengthField === undefined) {
        return undefined;
    }

    return `this.${toCamelIdentifier(lengthField.name)}`;
};

const visitInlineStructSlot = (
    context: ModuleContext,
    entry: RecordFieldSlot,
    baseOffset: number,
    visitors: InlineFieldVisitors,
): void => {
    const { field, slot } = entry;

    if (field.private || field.type === undefined || isInlineCallbackRef(context.library, field.type)) {
        return;
    }

    const jsName = toCamelIdentifier(field.name);
    const offset = baseOffset + slot.byteOffset;
    const nested = resolveInlineStructFields(context, field.type, field.cType);

    if (nested !== undefined) {
        visitors.nested(jsName, nested, offset);

        return;
    }

    if (!isAccessorEligibleType(context, field.type)) {
        return;
    }

    const descriptor = context.hoistDescriptor(renderDescriptor(context, field.type, "none"));
    visitors.leaf({ jsName, descriptor, offset, slot, type: field.type });
};

const visitInlineStructFields = (
    context: ModuleContext,
    fields: GirField[],
    baseOffset: number,
    visitors: InlineFieldVisitors,
): void => {
    const { slots } = computeRecordFieldSlots(context, fields);

    for (const entry of slots) {
        visitInlineStructSlot(context, entry, baseOffset, visitors);
    }
};

const inlineLeafCount = (context: ModuleContext, fields: GirField[]): number => {
    let count = 0;

    visitInlineStructFields(context, fields, 0, {
        leaf: () => {
            count += 1;
        },
        nested: (_jsName, nested) => {
            count += inlineLeafCount(context, nested);
        },
    });

    return count;
};

const elementAccessExpr = (descriptor: string, offset: number): string =>
    `read(__array, ${descriptor}, __base + ${String(offset)})`;

const renderElementReadEntry = (context: ModuleContext, visit: InlineFieldVisit): string => {
    const { jsName, descriptor, offset, slot, type } = visit;
    const access = elementAccessExpr(descriptor, offset);

    if (slot.bitWidth === undefined) {
        return `${jsName}: ${access} as ${renderTsType(context, type, false)}`;
    }

    const shift = slot.bitOffset ?? 0;

    return `${jsName}: (((${access} as number) >>> ${String(shift)}) & ${String(bitMask(slot.bitWidth))})`;
};

const renderElementReadObject = (context: ModuleContext, fields: GirField[], baseOffset: number): string => {
    const entries: string[] = [];

    visitInlineStructFields(context, fields, baseOffset, {
        leaf: (visit) => {
            entries.push(renderElementReadEntry(context, visit));
        },
        nested: (jsName, nested, offset) => {
            entries.push(`${jsName}: ${renderElementReadObject(context, nested, offset)}`);
        },
    });

    return `{ ${entries.join(", ")} }`;
};

const renderElementWriteStatement = (visit: InlineFieldVisit, valuePath: string): string => {
    const { jsName, descriptor, offset, slot } = visit;
    const valueExpr = `${valuePath}.${jsName}`;

    if (slot.bitWidth === undefined) {
        return `write(__array, ${descriptor}, __base + ${String(offset)}, ${valueExpr});`;
    }

    const merged = mergeBitfield(
        `(${elementAccessExpr(descriptor, offset)} as number)`,
        valueExpr,
        bitMask(slot.bitWidth),
        slot.bitOffset ?? 0,
    );

    return `write(__array, ${descriptor}, __base + ${String(offset)}, ${merged});`;
};

const appendElementWriteStatements = (context: ModuleContext, options: ElementWriteOptions): void => {
    const { fields, baseOffset, valuePath, out } = options;

    visitInlineStructFields(context, fields, baseOffset, {
        leaf: (visit) => {
            out.push(renderElementWriteStatement(visit, valuePath));
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

const structArrayGetterBlock = (options: StructArrayAccessorOptions): string => {
    const { context, jsName, tsType, elementDescriptor, offset, lengthExpr, elementSize, elementFields } = options;
    const element = renderElementReadObject(context, elementFields, 0);
    const loop = [`const __base = __index * ${String(elementSize)};`, `__result.push(${element});`].join("\n");
    const handleType = "ReturnType<typeof getHandle>";

    const body = [
        `const __array = read(getHandle(this), ${elementDescriptor}, ${String(offset)}) as ${handleType};`,
        `const __result: ${tsType} = [];`,
        `for (let __index = 0; __index < ${lengthExpr}; __index++) {`,
        indent(loop, 1),
        "}",
        "return __result;",
    ].join("\n");

    return renderBlock(`get ${jsName}(): ${tsType}`, body);
};

const structArraySetterStatements = (context: ModuleContext, options: StructArrayAccessorOptions): string => {
    const { elementDescriptor, offset, elementSize, elementFields, lengthExpr } = options;
    const writes: string[] = [];

    appendElementWriteStatements(context, {
        fields: elementFields,
        baseOffset: 0,
        valuePath: "__element",
        out: writes,
    });

    const loop = [`const __base = __index * ${String(elementSize)};`, ...writes].join("\n");

    return [
        `const __descriptor = ${elementDescriptor};`,
        `const __array = read(getHandle(this), __descriptor, ${String(offset)}) as ReturnType<typeof getHandle>;`,
        "for (const [__index, __element] of __value.entries()) {",
        indent(`if (__index >= ${lengthExpr}) {\n    break;\n}\n\n${loop}`, 1),
        "}",
        `write(getHandle(this), __descriptor, ${String(offset)}, __array);`,
    ].join("\n");
};

const structArraySetterBlock = (options: StructArrayAccessorOptions): string =>
    renderBlock(
        `set ${options.jsName}(__value: ${options.tsType})`,
        structArraySetterStatements(options.context, options),
    );

const isPlainDataRecord = (record: GirRecord): boolean =>
    record.glibGetType === undefined &&
    record.constructors.length === 0 &&
    record.functions.length === 0 &&
    record.methods.length === 0;

const resolveStructArrayElements = (context: ModuleContext, fieldType: TypeId): StructArrayElements | undefined => {
    const arrayType = context.library.typeFor(fieldType);

    if (arrayType?.kind !== "carray") {
        return undefined;
    }

    const elementType = context.library.typeFor(arrayType.element);

    if (elementType?.kind === "record" && !isPlainDataRecord(elementType.value)) {
        return undefined;
    }

    const elementFields = resolveInlineStructFields(context, arrayType.element, arrayType.elementCType);

    if (elementFields === undefined) {
        return undefined;
    }

    return { arrayType, elementFields };
};

const resolveStructArrayShape = (
    context: ModuleContext,
    elements: StructArrayElements,
    siblingFields: GirField[],
): { lengthExpr: string; elementSize: number } | undefined => {
    const lengthExpr = arrayLengthExpression(elements.arrayType, siblingFields);

    if (lengthExpr === undefined) {
        return undefined;
    }

    const elementSize = computeRecordFieldSlots(context, elements.elementFields).size;

    if (elementSize === 0) {
        return undefined;
    }

    return { lengthExpr, elementSize };
};

const resolveStructArray = (context: ModuleContext, target: StructArrayTarget): StructArrayResolution | undefined => {
    const { field, slot, siblingFields } = target;

    if (field.type === undefined || slot.bitWidth !== undefined) {
        return undefined;
    }

    const elements = resolveStructArrayElements(context, field.type);

    if (elements === undefined) {
        return undefined;
    }

    const shape = resolveStructArrayShape(context, elements, siblingFields);

    if (shape === undefined || inlineLeafCount(context, elements.elementFields) === 0) {
        return undefined;
    }

    return {
        fieldType: field.type,
        elementFields: elements.elementFields,
        lengthExpr: shape.lengthExpr,
        elementSize: shape.elementSize,
    };
};

const renderStructArrayAccessor = (context: ModuleContext, target: StructArrayTarget): string | undefined => {
    const resolution = resolveStructArray(context, target);

    if (resolution === undefined) {
        return undefined;
    }

    const { field, jsName, slot } = target;
    const { fieldType, elementFields, lengthExpr, elementSize } = resolution;
    context.addRuntimeImport("read");
    context.addRuntimeImport("getHandle");
    context.addRuntimeImport("t");

    const options: StructArrayAccessorOptions = {
        context,
        jsName,
        tsType: renderTsType(context, fieldType, false),
        elementDescriptor: tStruct("borrowed", {
            size: `${lengthExpr} * ${String(elementSize)}`,
            wrapperClass: undefined,
            isCallerAllocated: false,
        }),
        offset: slot.byteOffset,
        lengthExpr,
        elementSize,
        elementFields,
    };

    const blocks: string[] = [];

    if (field.readable) {
        blocks.push(structArrayGetterBlock(options));
    }

    if (field.writable) {
        context.addRuntimeImport("write");
        blocks.push(structArraySetterBlock(options));
    }

    return blocks.length === 0 ? undefined : blocks.join("\n\n");
};

const getterBlock = (options: AccessorOptions): string => {
    const { context, jsName, tsType, descriptor, slot, fieldType } = options;
    context.addRuntimeImport("read");
    context.addRuntimeImport("getHandle");

    if (slot.bitWidth === undefined) {
        const valueExpression = `read(getHandle(this), ${descriptor}, ${String(slot.byteOffset)})`;

        const wrapped = wrapReturnValue(context, {
            ref: fieldType,
            isNullable: false,
            valueExpression,
        });

        const body = `return ${wrapped};`;

        return renderBlock(`get ${jsName}(): ${tsType}`, body);
    }

    const mask = bitMask(slot.bitWidth);
    const shift = slot.bitOffset ?? 0;
    const readUnit = `const __unit = read(getHandle(this), ${descriptor}, ${String(slot.byteOffset)}) as number;`;
    const body = `${readUnit}\nreturn (((__unit >>> ${String(shift)}) & ${String(mask)}) >>> 0) as ${tsType};`;

    return renderBlock(`get ${jsName}(): ${tsType}`, body);
};

const setterBody = (context: ModuleContext, descriptor: string, slot: FieldSlot): string => {
    context.addRuntimeImport("getHandle");

    return emitFieldWrite(context, { descriptor, slot, targetExpr: "getHandle(this)", valueExpr: "value" });
};

const setterBlock = (options: AccessorOptions): string =>
    renderBlock(
        `set ${options.jsName}(value: ${options.tsType})`,
        setterBody(options.context, options.descriptor, options.slot),
    );

export {
    isEmittableField,
    isInlineField,
    emitFieldWrite,
    resolveRecordFieldEntry,
    renderRecordFieldAccessor,
};
