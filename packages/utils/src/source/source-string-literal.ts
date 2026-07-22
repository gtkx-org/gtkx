const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

const SOURCE_ESCAPES: Record<string, string> = {
    "<": "\\u003C",
    ">": "\\u003E",
    [LINE_SEPARATOR]: "\\u2028",
    [PARAGRAPH_SEPARATOR]: "\\u2029",
};

const UNSAFE_SOURCE_CHARS = new RegExp(`[${Object.keys(SOURCE_ESCAPES).join("")}]`, "g");

/**
 * Encodes a string as a JavaScript string literal, additionally escaping characters that are unsafe
 * to embed in generated source (angle brackets and the line and paragraph separators).
 *
 * @param value - The string to encode.
 * @returns The quoted, source-safe string literal.
 *
 * @example
 * sourceStringLiteral("hello"); // '"hello"'
 */
export function sourceStringLiteral(value: string): string {
    return JSON.stringify(value).replace(UNSAFE_SOURCE_CHARS, (char) => SOURCE_ESCAPES[char] ?? char);
}
