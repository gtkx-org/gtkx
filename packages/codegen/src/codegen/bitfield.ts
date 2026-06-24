export const bitMask = (width: number): number => {
    if (width >= 32) return 0xffffffff;
    return (1 << width) - 1;
};

export const mergeBitfield = (readExpr: string, valueExpr: string, mask: number, shift: number): string =>
    `((${readExpr} & ~(${mask} << ${shift})) | ((Number(${valueExpr}) & ${mask}) << ${shift})) >>> 0`;
