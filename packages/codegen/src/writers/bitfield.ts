/**
 * The bit mask covering a bitfield member's low `width` bits. A width of 32 or
 * more saturates to `0xffffffff`: in JavaScript `1 << 32` wraps to `1`, so
 * `(1 << width) - 1` would yield `0` for a full 32-bit word and silently drop
 * every written bit.
 *
 * @param width - The bitfield member's width in bits
 */
export const bitMask = (width: number): number => {
    if (width >= 32) return 0xffffffff;
    return (1 << width) - 1;
};

/**
 * Renders the read-modify-write expression that merges a new bitfield value
 * into its shared storage word: the surrounding bits are read from
 * `readExpr`, the member's `mask`-wide window at `shift` is cleared, and the
 * masked new value is shifted in. The result is coerced to an unsigned 32-bit
 * integer with `>>> 0`.
 *
 * @param readExpr - Expression yielding the current storage word as a number
 * @param valueExpr - Expression yielding the new value to write
 * @param mask - The member's {@link bitMask}
 * @param shift - The member's bit offset within the storage word
 */
export const mergeBitfield = (readExpr: string, valueExpr: string, mask: number, shift: number): string =>
    `((${readExpr} & ~(${mask} << ${shift})) | ((Number(${valueExpr}) & ${mask}) << ${shift})) >>> 0`;
