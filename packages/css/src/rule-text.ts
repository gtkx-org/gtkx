const NUL = "\u{0}";
const NUL_REASON = "carries a NUL byte, which GTK4 cannot load";

const hasNul = (rule: string): boolean => rule.includes(NUL);
const printableRule = (rule: string): string => rule.replaceAll(NUL, String.raw`\0`);

export { hasNul, NUL_REASON, printableRule };
