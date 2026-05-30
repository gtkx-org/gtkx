import { PRIMITIVE_SIZE, type PrimitiveCategory } from "./primitives.js";

/**
 * Size and alignment of a single field as it appears in a C struct laid out
 * according to the x86-64 ABI.
 */
export type FieldLayout = {
    /** Width of the field in bytes. */
    readonly size: number;
    /** Required alignment in bytes; storage offset rounds up to a multiple of this. */
    readonly align: number;
};

/**
 * Returns the `{ size, align }` pair for a primitive category.
 *
 * Pointers and pointer-sized integers (the `pointer` and 64-bit categories)
 * report 8/8. Smaller integers and floats report their natural width.
 *
 * @param category - The primitive category
 */
export const layoutOfPrimitive = (category: PrimitiveCategory): FieldLayout => {
    const size = PRIMITIVE_SIZE[category];
    return { size, align: size === 0 ? 1 : size };
};

const roundUp = (value: number, multiple: number): number => {
    if (multiple <= 1) return value;
    const remainder = value % multiple;
    return remainder === 0 ? value : value + (multiple - remainder);
};

/**
 * Layout slot for a single field that may participate in bitfield packing.
 *
 * `byteOffset` is always the offset of the underlying storage word; for
 * non-bitfield fields it is the field's offset directly, and for bitfield
 * members it is the start of the shared storage unit. `bitOffset` and
 * `bitWidth` are populated only for bitfield members.
 */
export type FieldSlot = {
    /** Byte offset of the storage word the field occupies. */
    readonly byteOffset: number;
    /** Bit position within the storage word, for bitfield members. */
    readonly bitOffset: number | undefined;
    /** Width in bits, for bitfield members. */
    readonly bitWidth: number | undefined;
};

/**
 * Describes a field for the purposes of layout computation.
 */
export type FieldLayoutInput = {
    /** Natural byte size and alignment of the field's value type. */
    readonly layout: FieldLayout;
    /** When set, the field is a bitfield member with this many bits. */
    readonly bits: number | undefined;
};

/**
 * Computes per-field byte offsets for a record, grouping consecutive
 * bitfield members of compatible storage widths into a shared storage
 * word.
 *
 * Mirrors the GCC/Itanium ABI rules for C bitfield packing in a
 * single-storage-word model: a new storage word is opened when the
 * underlying type's size changes, when the new field is not a bitfield,
 * or when adding the bits would exceed the word's bit count.
 *
 * A union (`isUnion`) overlays every member at byte offset 0; its size is the
 * largest member rounded up to the strongest member alignment.
 *
 * @param fields - Ordered field layouts and bit widths
 * @param isUnion - Whether the fields are union members (overlaid at offset 0)
 * @returns Parallel slot array and the total record size in bytes
 */
export const computeFieldSlots = (
    fields: readonly FieldLayoutInput[],
    isUnion = false,
): { readonly slots: readonly FieldSlot[]; readonly size: number } => {
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
