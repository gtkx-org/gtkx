import { toCamelIdentifier } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import { indent, renderBlock } from "../dsl/emit.js";
import type { GirField } from "../gir/field.js";
import type { FieldSlot } from "../gir/size.js";
import type { GirType } from "../gir/type.js";
import type { TypeId } from "../gir/type-id.js";
import { bitMask, mergeBitfield } from "./bitfield.js";
import { type BoxedFieldSlot, computeBoxedFieldSlots } from "./boxed-layout.js";
import { typeRefIsClassStruct } from "./class-struct-record.js";
import { tStruct } from "./descriptor.js";
import { wrapReturnValue } from "./return-wrap.js";
import { renderTsType } from "./ts-type.js";
import { isInlineCallbackRef, renderFfiType } from "./value.js";

export const renderBoxedFieldAccessor = (
    context: ModuleContext,
    slot: BoxedFieldSlot,
    claimedNames: Set<string>,
    siblingFields: GirField[],
): string | undefined => {
    const { field } = slot;
    if (field.private) return undefined;
    if (!field.readable && !field.writable) return undefined;
    if (field.type === undefined) return undefined;
    if (isInlineCallbackRef(context.repository, field.type)) return undefined;
    if (typeRefIsClassStruct(context, field.type)) return undefined;
    const jsName = toCamelIdentifier(field.name);
    if (claimedNames.has(jsName)) return undefined;
    if (jsName === "constructor") return undefined;

    const structArray = renderStructArrayAccessor(context, { field, jsName, slot: slot.slot, siblingFields });
    if (structArray !== undefined) return structArray;

    if (!isAccessorEligibleType(context, field.type)) {
        const tsType = renderTsType(context, field.type, false);
        return `declare ${jsName}: ${tsType};`;
    }

    const ffiType = renderFfiType(context, field.type, "none");
    const tsType = renderTsType(context, field.type, false);
    const accessorOptions: AccessorOptions = {
        context,
        jsName,
        tsType,
        ffiType,
        slot: slot.slot,
        fieldType: field.type,
    };
    const blocks: string[] = [getterBlock(accessorOptions)];
    if (field.writable) {
        blocks.push(setterBlock(accessorOptions));
    }
    return blocks.join("\n\n");
};

const isAccessorEligibleType = (context: ModuleContext, ref: TypeId): boolean => {
    const type = context.repository.typeOf(ref);
    if (type === undefined) return true;
    switch (type.kind) {
        case "primitive":
            return type.category !== "void" && type.category !== "unichar";
        case "class":
        case "interface":
        case "boxed":
        case "enum":
        case "alias":
            return true;
        case "callback":
            return context.repository.nameOf(ref) !== undefined;
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
    const type = context.repository.typeOf(ref);
    if (type?.kind !== "boxed") return undefined;
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

const renderElementReadObject = (context: ModuleContext, fields: GirField[], baseOffset: number): string => {
    const { slots } = computeBoxedFieldSlots(context, fields);
    const entries: string[] = [];
    for (const { field, slot } of slots) {
        if (field.private || field.type === undefined || isInlineCallbackRef(context.repository, field.type)) {
            continue;
        }
        const jsName = toCamelIdentifier(field.name);
        const offset = baseOffset + slot.byteOffset;
        const nested = resolveInlineStructFields(context, field.type, field.cType);
        if (nested !== undefined) {
            entries.push(`${jsName}: ${renderElementReadObject(context, nested, offset)}`);
            continue;
        }
        if (!isAccessorEligibleType(context, field.type)) continue;
        const ffi = renderFfiType(context, field.type, "none");
        if (slot.bitWidth === undefined) {
            entries.push(
                `${jsName}: read(__array, ${ffi}, __base + ${offset}) as ${renderTsType(context, field.type, false)}`,
            );
            continue;
        }
        const shift = slot.bitOffset ?? 0;
        entries.push(
            `${jsName}: (((read(__array, ${ffi}, __base + ${offset}) as number) >>> ${shift}) & ${bitMask(slot.bitWidth)})`,
        );
    }
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
    const { slots } = computeBoxedFieldSlots(context, fields);
    for (const { field, slot } of slots) {
        if (field.private || field.type === undefined || isInlineCallbackRef(context.repository, field.type)) {
            continue;
        }
        const valueExpr = `${valuePath}.${toCamelIdentifier(field.name)}`;
        const offset = baseOffset + slot.byteOffset;
        const nested = resolveInlineStructFields(context, field.type, field.cType);
        if (nested !== undefined) {
            appendElementWriteStatements(context, { fields: nested, baseOffset: offset, valuePath: valueExpr, out });
            continue;
        }
        if (!isAccessorEligibleType(context, field.type)) continue;
        const ffi = renderFfiType(context, field.type, "none");
        if (slot.bitWidth === undefined) {
            out.push(`write(__array, ${ffi}, __base + ${offset}, ${valueExpr});`);
            continue;
        }
        const mask = bitMask(slot.bitWidth);
        const shift = slot.bitOffset ?? 0;
        const merged = mergeBitfield(`read(__array, ${ffi}, __base + ${offset})`, valueExpr, mask, shift);
        out.push(`write(__array, ${ffi}, __base + ${offset}, ${merged});`);
    }
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
    bufferType: string;
    offset: number;
    lengthExpr: string;
    elementSize: number;
    elementFields: GirField[];
};

const structArrayGetterBlock = (options: StructArrayAccessorOptions): string => {
    const { context, jsName, tsType, bufferType, offset, lengthExpr, elementSize, elementFields } = options;
    const element = renderElementReadObject(context, elementFields, 0);
    const loop = [`const __base = __index * ${elementSize};`, `__result.push(${element});`].join("\n");
    const body = [
        `const __array = read(getHandle(this), ${bufferType}, ${offset});`,
        `const __result: ${tsType} = [];`,
        `for (let __index = 0; __index < ${lengthExpr}; __index++) {`,
        indent(loop, 1),
        "}",
        "return __result;",
    ].join("\n");
    return renderBlock(`get ${jsName}(): ${tsType}`, body);
};

const structArraySetterBlock = (options: StructArrayAccessorOptions): string => {
    const { context, jsName, tsType, bufferType, offset, elementSize, elementFields } = options;
    const writes: string[] = [];
    appendElementWriteStatements(context, {
        fields: elementFields,
        baseOffset: 0,
        valuePath: "__element",
        out: writes,
    });
    const loop = [`const __element = __value[__index];`, `const __base = __index * ${elementSize};`, ...writes].join(
        "\n",
    );
    const body = [
        `const __array = read(getHandle(this), ${bufferType}, ${offset});`,
        `for (let __index = 0; __index < __value.length; __index++) {`,
        indent(loop, 1),
        "}",
        `write(getHandle(this), ${bufferType}, ${offset}, __array);`,
    ].join("\n");
    return renderBlock(`set ${jsName}(__value: ${tsType})`, body);
};

const renderStructArrayAccessor = (context: ModuleContext, target: StructArrayTarget): string | undefined => {
    const { field, jsName, slot, siblingFields } = target;
    if (field.type === undefined || slot.bitWidth !== undefined) return undefined;
    const arrayType = context.repository.typeOf(field.type);
    if (arrayType?.kind !== "carray") return undefined;
    const elementFields = resolveInlineStructFields(context, arrayType.element, arrayType.elementCType);
    if (elementFields === undefined) return undefined;
    const lengthExpr = arrayLengthExpression(arrayType, siblingFields);
    if (lengthExpr === undefined) return undefined;
    const elementSize = computeBoxedFieldSlots(context, elementFields).size;
    if (elementSize === 0) return undefined;

    context.addNativeImport("read");
    context.addRuntimeImport("getHandle");
    context.addRuntimeImport("t");
    const options: StructArrayAccessorOptions = {
        context,
        jsName,
        tsType: renderTsType(context, field.type, false),
        bufferType: tStruct("borrowed", {
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
        context.addNativeImport("write");
        blocks.push(structArraySetterBlock(options));
    }
    return blocks.length === 0 ? undefined : blocks.join("\n\n");
};

type AccessorOptions = {
    context: ModuleContext;
    jsName: string;
    tsType: string;
    ffiType: string;
    slot: FieldSlot;
    fieldType: TypeId;
};

const getterBlock = (options: AccessorOptions): string => {
    const { context, jsName, tsType, ffiType, slot, fieldType } = options;
    context.addNativeImport("read");
    context.addRuntimeImport("getHandle");
    if (slot.bitWidth === undefined) {
        const valueExpression = `read(getHandle(this), ${ffiType}, ${slot.byteOffset})`;
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
    const body = `const __unit = read(getHandle(this), ${ffiType}, ${slot.byteOffset}) as number;\nreturn (((__unit >>> ${shift}) & ${mask}) >>> 0) as ${tsType};`;
    return renderBlock(`get ${jsName}(): ${tsType}`, body);
};

const setterBlock = (options: AccessorOptions): string => {
    const { context, jsName, tsType, ffiType, slot } = options;
    context.addNativeImport("write");
    context.addRuntimeImport("getHandle");
    if (slot.bitWidth === undefined) {
        const body = `write(getHandle(this), ${ffiType}, ${slot.byteOffset}, value);`;
        return renderBlock(`set ${jsName}(value: ${tsType})`, body);
    }
    context.addNativeImport("read");
    const mask = bitMask(slot.bitWidth);
    const shift = slot.bitOffset ?? 0;
    const merged = mergeBitfield("__unit", "value", mask, shift);
    const body = `const __unit = read(getHandle(this), ${ffiType}, ${slot.byteOffset}) as number;\nconst __next = ${merged};\nwrite(getHandle(this), ${ffiType}, ${slot.byteOffset}, __next);`;
    return renderBlock(`set ${jsName}(value: ${tsType})`, body);
};
