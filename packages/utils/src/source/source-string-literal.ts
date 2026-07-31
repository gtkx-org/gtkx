const LINE_SEPARATOR = String.fromCodePoint(0x20_28);
const PARAGRAPH_SEPARATOR = String.fromCodePoint(0x20_29);

const SOURCE_ESCAPES: Record<string, string> = {
    "<": String.raw`\u003C`,
    ">": String.raw`\u003E`,
    [LINE_SEPARATOR]: String.raw`\u2028`,
    [PARAGRAPH_SEPARATOR]: String.raw`\u2029`,
};

const UNSAFE_SOURCE_CHARS = new RegExp(`[${Object.keys(SOURCE_ESCAPES).join("")}]`, "g");

function sourceStringLiteral(value: string): string {
    return JSON.stringify(value).replaceAll(UNSAFE_SOURCE_CHARS, (char) => SOURCE_ESCAPES[char] ?? char);
}

export { sourceStringLiteral };
