import { PRIMITIVE_SIZE, type PrimitiveCategory } from "./primitives.js";

type FieldLayout = {
    size: number;
    align: number;
};

type FieldSlot = {
    byteOffset: number;
    bitOffset: number | undefined;
    bitWidth: number | undefined;
};

type FieldLayoutInput = {
    layout: FieldLayout;
    bits: number | undefined;
};

type StructLayoutState = {
    bitCursor: number;
    maxAlign: number;
};

const floorDown = (value: number, multiple: number): number => value - (value % multiple);

const layoutOfPrimitive = (category: PrimitiveCategory): FieldLayout => {
    const size = PRIMITIVE_SIZE[category];

    return { size, align: size === 0 ? 1 : size };
};

const roundUp = (value: number, multiple: number): number => {
    if (multiple <= 1) {
        return value;
    }

    const remainder = value % multiple;

    return remainder === 0 ? value : value + (multiple - remainder);
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

const pushPlainField = (state: StructLayoutState, slots: FieldSlot[], field: FieldLayoutInput, align: number): void => {
    const byteOffset = roundUp(roundUp(state.bitCursor, 8) / 8, align);
    slots.push({ byteOffset, bitOffset: undefined, bitWidth: undefined });
    state.bitCursor = (byteOffset + field.layout.size) * 8;
};

// SysV AMD64 places a bit-field at the current bit offset whenever it still fits inside a storage
// unit of its declared type aligned to that type's alignment, so the unit the cursor already sits in
// may have room even though the cursor is not on a unit boundary.
const pushBitfield = (input: {
    state: StructLayoutState;
    slots: FieldSlot[];
    field: FieldLayoutInput;
    align: number;
    bits: number;
}): void => {
    const { state, slots, field, align, bits } = input;
    const unitStart = floorDown(floorDown(state.bitCursor, 8) / 8, align);
    const isFitsInCurrentUnit = state.bitCursor + bits <= (unitStart + field.layout.size) * 8;
    const byteOffset = isFitsInCurrentUnit ? unitStart : roundUp(roundUp(state.bitCursor, 8) / 8, align);

    if (!isFitsInCurrentUnit) {
        state.bitCursor = byteOffset * 8;
    }

    slots.push({ byteOffset, bitOffset: state.bitCursor - byteOffset * 8, bitWidth: bits });
    state.bitCursor += bits;
};

const processStructField = (state: StructLayoutState, slots: FieldSlot[], field: FieldLayoutInput): void => {
    const align = Math.max(1, field.layout.align);

    if (align > state.maxAlign) {
        state.maxAlign = align;
    }

    if (field.bits === undefined) {
        pushPlainField(state, slots, field, align);

        return;
    }

    pushBitfield({ state, slots, field, align, bits: field.bits });
};

const computeStructSlots = (fields: FieldLayoutInput[]): { slots: FieldSlot[]; size: number } => {
    const slots: FieldSlot[] = [];
    const state: StructLayoutState = { bitCursor: 0, maxAlign: 1 };

    for (const field of fields) {
        processStructField(state, slots, field);
    }

    return { slots, size: roundUp(roundUp(state.bitCursor, 8) / 8, state.maxAlign) };
};

const computeFieldSlots = (fields: FieldLayoutInput[], isUnion = false): { slots: FieldSlot[]; size: number } =>
    isUnion ? computeUnionSlots(fields) : computeStructSlots(fields);

export { layoutOfPrimitive, computeFieldSlots, type FieldLayout, type FieldSlot, type FieldLayoutInput };
