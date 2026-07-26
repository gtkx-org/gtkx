import { PRIMITIVE_SIZE, type PrimitiveCategory } from "./primitives.js";

export type FieldLayout = {
    size: number;
    align: number;
};

export const layoutOfPrimitive = (category: PrimitiveCategory): FieldLayout => {
    const size = PRIMITIVE_SIZE[category];
    return { size, align: size === 0 ? 1 : size };
};

const roundUp = (value: number, multiple: number): number => {
    if (multiple <= 1) return value;
    const remainder = value % multiple;
    return remainder === 0 ? value : value + (multiple - remainder);
};

export type FieldSlot = {
    byteOffset: number;
    bitOffset: number | undefined;
    bitWidth: number | undefined;
};

export type FieldLayoutInput = {
    layout: FieldLayout;
    bits: number | undefined;
};

const computeUnionSlots = (fields: FieldLayoutInput[]): { slots: FieldSlot[]; size: number } => {
    let maxSize = 0;
    let maxAlign = 1;
    const slots = fields.map((field) => {
        maxSize = Math.max(maxSize, field.layout.size);
        maxAlign = Math.max(maxAlign, field.layout.align);
        return { byteOffset: 0, bitOffset: field.bits === undefined ? undefined : 0, bitWidth: field.bits };
    });
    return { slots, size: roundUp(maxSize, maxAlign) };
};

type StructLayoutState = {
    cursor: number;
    maxAlign: number;
    bitfieldWordOffset: number | undefined;
    bitfieldWordSize: number;
    bitfieldUsedBits: number;
};

const pushPlainField = (state: StructLayoutState, slots: FieldSlot[], field: FieldLayoutInput, align: number): void => {
    state.bitfieldWordOffset = undefined;
    state.bitfieldWordSize = 0;
    state.bitfieldUsedBits = 0;
    state.cursor = roundUp(state.cursor, align);
    slots.push({ byteOffset: state.cursor, bitOffset: undefined, bitWidth: undefined });
    state.cursor += field.layout.size;
};

const pushBitfield = (input: {
    state: StructLayoutState;
    slots: FieldSlot[];
    field: FieldLayoutInput;
    align: number;
    bits: number;
}): void => {
    const { state, slots, field, align, bits } = input;
    const wordSizeBits = field.layout.size * 8;
    const fits =
        state.bitfieldWordOffset !== undefined &&
        state.bitfieldWordSize === field.layout.size &&
        state.bitfieldUsedBits + bits <= wordSizeBits;
    if (!fits) {
        state.cursor = roundUp(state.cursor, align);
        state.bitfieldWordOffset = state.cursor;
        state.bitfieldWordSize = field.layout.size;
        state.bitfieldUsedBits = 0;
        state.cursor += field.layout.size;
    }
    slots.push({ byteOffset: state.bitfieldWordOffset ?? 0, bitOffset: state.bitfieldUsedBits, bitWidth: bits });
    state.bitfieldUsedBits += bits;
};

const processStructField = (state: StructLayoutState, slots: FieldSlot[], field: FieldLayoutInput): void => {
    const align = Math.max(1, field.layout.align);
    if (align > state.maxAlign) state.maxAlign = align;
    if (field.bits === undefined) {
        pushPlainField(state, slots, field, align);
        return;
    }
    pushBitfield({ state, slots, field, align, bits: field.bits });
};

const computeStructSlots = (fields: FieldLayoutInput[]): { slots: FieldSlot[]; size: number } => {
    const slots: FieldSlot[] = [];
    const state: StructLayoutState = {
        cursor: 0,
        maxAlign: 1,
        bitfieldWordOffset: undefined,
        bitfieldWordSize: 0,
        bitfieldUsedBits: 0,
    };
    for (const field of fields) {
        processStructField(state, slots, field);
    }
    return { slots, size: roundUp(state.cursor, state.maxAlign) };
};

export const computeFieldSlots = (fields: FieldLayoutInput[], isUnion = false): { slots: FieldSlot[]; size: number } =>
    isUnion ? computeUnionSlots(fields) : computeStructSlots(fields);
