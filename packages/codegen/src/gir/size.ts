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

export const computeFieldSlots = (
    fields: FieldLayoutInput[],
    isUnion = false,
): { slots: FieldSlot[]; size: number } => {
    if (isUnion) {
        let maxSize = 0;
        let maxAlign = 1;
        const unionSlots = fields.map((field) => {
            maxSize = Math.max(maxSize, field.layout.size);
            maxAlign = Math.max(maxAlign, field.layout.align);
            return { byteOffset: 0, bitOffset: field.bits === undefined ? undefined : 0, bitWidth: field.bits };
        });
        return { slots: unionSlots, size: roundUp(maxSize, maxAlign) };
    }
    const slots: FieldSlot[] = [];
    let cursor = 0;
    let maxAlign = 1;
    let bitfieldWordOffset: number | undefined;
    let bitfieldWordSize = 0;
    let bitfieldUsedBits = 0;
    for (const field of fields) {
        const align = Math.max(1, field.layout.align);
        if (align > maxAlign) maxAlign = align;
        if (field.bits === undefined) {
            bitfieldWordOffset = undefined;
            bitfieldWordSize = 0;
            bitfieldUsedBits = 0;
            cursor = roundUp(cursor, align);
            slots.push({ byteOffset: cursor, bitOffset: undefined, bitWidth: undefined });
            cursor += field.layout.size;
            continue;
        }
        const wordSizeBits = field.layout.size * 8;
        const fits =
            bitfieldWordOffset !== undefined &&
            bitfieldWordSize === field.layout.size &&
            bitfieldUsedBits + field.bits <= wordSizeBits;
        if (!fits) {
            cursor = roundUp(cursor, align);
            bitfieldWordOffset = cursor;
            bitfieldWordSize = field.layout.size;
            bitfieldUsedBits = 0;
            cursor += field.layout.size;
        }
        slots.push({
            byteOffset: bitfieldWordOffset ?? 0,
            bitOffset: bitfieldUsedBits,
            bitWidth: field.bits,
        });
        bitfieldUsedBits += field.bits;
    }
    return { slots, size: roundUp(cursor, maxAlign) };
};
