import type { ModuleContext } from "../dsl/context.js";
import { indent } from "../dsl/emit.js";
import { camelCase, toIdentifier } from "@gtkx/utils";
import type { GirField } from "../gir/field.js";
import type { FieldSlot } from "../gir/size.js";
import type { GirTypeRef } from "../gir/type-ref.js";
import { type BoxedFieldSlot, computeBoxedFieldSlots } from "./boxed-layout.js";
import { typeRefIsClassStruct } from "./class-struct-record.js";
import { writeTsType } from "./types-ts.js";
import { writeFfiType } from "./value.js";

/**
 * Renders the `get` / `set` accessor pair for a single boxed field.
 *
 * The accessor reads through the runtime's `read(handle, ffiType, offset)`
 * (or `write` for the setter), with bitfield members threading through a
 * read-modify-write sequence into their shared storage word. Fields whose
 * type cannot be marshaled at present (callbacks, varargs, inline arrays
 * of complex types) are skipped silently.
 *
 * @param ctx - The module context
 * @param slot - The field plus its layout slot
 * @param claimedMemberNames - Names already used by emitted methods
 */
export const renderBoxedFieldAccessor = (
    ctx: ModuleContext,
    slot: BoxedFieldSlot,
    claimedMemberNames: ReadonlySet<string>,
    siblingFields: readonly GirField[],
): string | undefined => {
    const { field } = slot;
    if (field.private) return undefined;
    if (!field.readable && !field.writable) return undefined;
    if (field.callback !== undefined) return undefined;
    if (field.type === undefined) return undefined;
    if (typeRefIsClassStruct(ctx, field.type)) return undefined;
    const jsName = toIdentifier(camelCase(field.name));
    if (claimedMemberNames.has(jsName)) return undefined;
    if (jsName === "constructor") return undefined;

    const structArray = renderStructArrayAccessor(ctx, { field, jsName, slot: slot.slot, siblingFields });
    if (structArray !== undefined) return structArray;

    if (!isAccessorEligibleType(field.type)) {
        const tsType = writeTsType(ctx, field.type, false);
        const modifier = field.writable ? "declare" : "declare readonly";
        return `${modifier} ${jsName}: ${tsType};`;
    }

    const ffiType = writeFfiType(ctx, field.type, "none");
    const tsType = writeTsType(ctx, field.type, false);
    const accessorOptions: AccessorOptions = { ctx, jsName, tsType, ffiType, slot: slot.slot };
    const blocks: string[] = [getterBlock(accessorOptions)];
    if (field.writable) {
        blocks.push(setterBlock(accessorOptions));
    }
    return blocks.join("\n\n");
};

const isAccessorEligibleType = (ref: GirTypeRef): boolean => {
    switch (ref.kind) {
        case "primitive":
            return ref.category !== "void" && ref.category !== "unichar";
        case "named":
            return true;
        case "array":
            return ref.fixedSize !== undefined;
        case "list":
        case "hashtable":
            return false;
        case "callback":
        case "varargs":
            return false;
    }
};

const resolveInlineStructFields = (
    ctx: ModuleContext,
    ref: GirTypeRef | undefined,
): readonly GirField[] | undefined => {
    if (ref === undefined || ref.kind !== "named") return undefined;
    if (ref.cType?.endsWith("*") === true) return undefined;
    const resolved = ctx.repository.resolveNamed(ref.namespaceName ?? ctx.namespace.name, ref.typeName);
    if (resolved === undefined || resolved.kind !== "boxed") return undefined;
    if (resolved.value.cType?.endsWith("*") === true) return undefined;
    if (resolved.value.fields.length === 0) return undefined;
    return resolved.value.fields;
};

const arrayLengthExpression = (
    arrayRef: Extract<GirTypeRef, { kind: "array" }>,
    siblingFields: readonly GirField[],
): string | undefined => {
    if (arrayRef.fixedSize !== undefined) return String(arrayRef.fixedSize);
    if (arrayRef.lengthParameterIndex === undefined) return undefined;
    const lengthField = siblingFields.filter((field) => !field.private)[arrayRef.lengthParameterIndex];
    if (lengthField === undefined) return undefined;
    return `this.${toIdentifier(camelCase(lengthField.name))}`;
};

const renderElementReadObject = (ctx: ModuleContext, fields: readonly GirField[], baseOffset: number): string => {
    const { slots } = computeBoxedFieldSlots(ctx, fields);
    const entries: string[] = [];
    for (const { field, slot } of slots) {
        if (field.private || field.type === undefined || field.callback !== undefined) continue;
        const jsName = toIdentifier(camelCase(field.name));
        const offset = baseOffset + slot.byteOffset;
        const nested = resolveInlineStructFields(ctx, field.type);
        if (nested !== undefined) {
            entries.push(`${jsName}: ${renderElementReadObject(ctx, nested, offset)}`);
            continue;
        }
        if (!isAccessorEligibleType(field.type)) continue;
        const ffi = writeFfiType(ctx, field.type, "none");
        if (slot.bitWidth === undefined) {
            entries.push(
                `${jsName}: read(__array, ${ffi}, __base + ${offset}) as ${writeTsType(ctx, field.type, false)}`,
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

type ElementWritePlan = {
    readonly fields: readonly GirField[];
    readonly baseOffset: number;
    readonly valuePath: string;
    readonly out: string[];
};

const renderElementWriteStatements = (ctx: ModuleContext, plan: ElementWritePlan): void => {
    const { fields, baseOffset, valuePath, out } = plan;
    const { slots } = computeBoxedFieldSlots(ctx, fields);
    for (const { field, slot } of slots) {
        if (field.private || field.type === undefined || field.callback !== undefined) continue;
        const valueExpr = `${valuePath}.${toIdentifier(camelCase(field.name))}`;
        const offset = baseOffset + slot.byteOffset;
        const nested = resolveInlineStructFields(ctx, field.type);
        if (nested !== undefined) {
            renderElementWriteStatements(ctx, { fields: nested, baseOffset: offset, valuePath: valueExpr, out });
            continue;
        }
        if (!isAccessorEligibleType(field.type)) continue;
        const ffi = writeFfiType(ctx, field.type, "none");
        if (slot.bitWidth === undefined) {
            out.push(`write(__array, ${ffi}, __base + ${offset}, ${valueExpr});`);
            continue;
        }
        const mask = bitMask(slot.bitWidth);
        const shift = slot.bitOffset ?? 0;
        out.push(
            `write(__array, ${ffi}, __base + ${offset}, ((read(__array, ${ffi}, __base + ${offset}) & ~(${mask} << ${shift})) | ((Number(${valueExpr}) & ${mask}) << ${shift})) >>> 0);`,
        );
    }
};

type StructArrayTarget = {
    readonly field: GirField;
    readonly jsName: string;
    readonly slot: FieldSlot;
    readonly siblingFields: readonly GirField[];
};

type StructArrayContext = {
    readonly ctx: ModuleContext;
    readonly jsName: string;
    readonly tsType: string;
    readonly bufferType: string;
    readonly offset: number;
    readonly lengthExpr: string;
    readonly elementSize: number;
    readonly elementFields: readonly GirField[];
};

const structArrayGetterBlock = (context: StructArrayContext): string => {
    const { ctx, jsName, tsType, bufferType, offset, lengthExpr, elementSize, elementFields } = context;
    const element = renderElementReadObject(ctx, elementFields, 0);
    const loop = [`const __base = __index * ${elementSize};`, `__result.push(${element});`].join("\n");
    const body = [
        `const __array = read(getHandle(this), ${bufferType}, ${offset});`,
        `const __result: ${tsType} = [];`,
        `for (let __index = 0; __index < ${lengthExpr}; __index++) {`,
        indent(loop, 1),
        "}",
        "return __result;",
    ].join("\n");
    return `get ${jsName}(): ${tsType} {\n${indent(body, 1)}\n}`;
};

const structArraySetterBlock = (context: StructArrayContext): string => {
    const { ctx, jsName, tsType, bufferType, offset, elementSize, elementFields } = context;
    const writes: string[] = [];
    renderElementWriteStatements(ctx, { fields: elementFields, baseOffset: 0, valuePath: "__element", out: writes });
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
    return `set ${jsName}(__value: ${tsType}) {\n${indent(body, 1)}\n}`;
};

const renderStructArrayAccessor = (ctx: ModuleContext, target: StructArrayTarget): string | undefined => {
    const { field, jsName, slot, siblingFields } = target;
    const arrayRef = field.type;
    if (arrayRef === undefined || arrayRef.kind !== "array" || slot.bitWidth !== undefined) return undefined;
    const elementFields = resolveInlineStructFields(ctx, arrayRef.element);
    if (elementFields === undefined) return undefined;
    const lengthExpr = arrayLengthExpression(arrayRef, siblingFields);
    if (lengthExpr === undefined) return undefined;
    const elementSize = computeBoxedFieldSlots(ctx, elementFields).size;
    if (elementSize === 0) return undefined;

    ctx.addRuntimeImport("read");
    ctx.addRuntimeImport("getHandle");
    ctx.addRuntimeImport("t");
    const context: StructArrayContext = {
        ctx,
        jsName,
        tsType: writeTsType(ctx, arrayRef, false),
        bufferType: `t.struct("borrowed", ${lengthExpr} * ${elementSize})`,
        offset: slot.byteOffset,
        lengthExpr,
        elementSize,
        elementFields,
    };
    const blocks: string[] = [];
    if (field.readable) blocks.push(structArrayGetterBlock(context));
    if (field.writable) {
        ctx.addRuntimeImport("write");
        blocks.push(structArraySetterBlock(context));
    }
    return blocks.length === 0 ? undefined : blocks.join("\n\n");
};

type AccessorOptions = {
    readonly ctx: ModuleContext;
    readonly jsName: string;
    readonly tsType: string;
    readonly ffiType: string;
    readonly slot: FieldSlot;
};

const getterBlock = (options: AccessorOptions): string => {
    const { ctx, jsName, tsType, ffiType, slot } = options;
    ctx.addRuntimeImport("read");
    ctx.addRuntimeImport("getHandle");
    if (slot.bitWidth === undefined) {
        const body = `return read(getHandle(this), ${ffiType}, ${slot.byteOffset}) as ${tsType};`;
        return `get ${jsName}(): ${tsType} {\n${indent(body, 1)}\n}`;
    }
    const mask = bitMask(slot.bitWidth);
    const shift = slot.bitOffset ?? 0;
    const body = `const __unit = read(getHandle(this), ${ffiType}, ${slot.byteOffset}) as number;\nreturn (((__unit >>> ${shift}) & ${mask}) >>> 0) as ${tsType};`;
    return `get ${jsName}(): ${tsType} {\n${indent(body, 1)}\n}`;
};

const setterBlock = (options: AccessorOptions): string => {
    const { ctx, jsName, tsType, ffiType, slot } = options;
    ctx.addRuntimeImport("write");
    ctx.addRuntimeImport("getHandle");
    if (slot.bitWidth === undefined) {
        const body = `write(getHandle(this), ${ffiType}, ${slot.byteOffset}, value);`;
        return `set ${jsName}(value: ${tsType}) {\n${indent(body, 1)}\n}`;
    }
    ctx.addRuntimeImport("read");
    const mask = bitMask(slot.bitWidth);
    const shift = slot.bitOffset ?? 0;
    const body = `const __unit = read(getHandle(this), ${ffiType}, ${slot.byteOffset}) as number;\nconst __next = ((__unit & ~(${mask} << ${shift})) | ((Number(value) & ${mask}) << ${shift})) >>> 0;\nwrite(getHandle(this), ${ffiType}, ${slot.byteOffset}, __next);`;
    return `set ${jsName}(value: ${tsType}) {\n${indent(body, 1)}\n}`;
};

const bitMask = (width: number): number => {
    if (width >= 32) return 0xffffffff;
    return (1 << width) - 1;
};
