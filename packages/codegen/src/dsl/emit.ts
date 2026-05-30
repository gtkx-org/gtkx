/**
 * Tiny string-builder helpers used by the writers to assemble TypeScript
 * source. The DSL deliberately stops short of modelling expressions or
 * statements — writers compose strings directly using these primitives.
 */

/**
 * Indents each line of `block` by `level` four-space units.
 *
 * Lines that are empty stay empty (no trailing whitespace).
 *
 * @param block - The multi-line source fragment
 * @param level - Number of indentation steps to apply
 */
export const indent = (block: string, level: number): string => {
    if (level <= 0) return block;
    const prefix = "    ".repeat(level);
    return block
        .split("\n")
        .map((line) => (line.length === 0 ? line : `${prefix}${line}`))
        .join("\n");
};

/**
 * Joins `parts` with commas, dropping `undefined` entries.
 */
export const joinArgs = (parts: ReadonlyArray<string | undefined>): string =>
    parts.filter((part): part is string => part !== undefined).join(", ");

const UNSAFE_SOURCE_CHARS = /[<>\u2028\u2029]/g;

const escapeSourceChar = (char: string): string => {
    switch (char) {
        case "<":
            return "\\u003C";
        case ">":
            return "\\u003E";
        case "\u2028":
            return "\\u2028";
        case "\u2029":
            return "\\u2029";
        default:
            return char;
    }
};

/**
 * Quotes a string for safe embedding as a literal in generated TypeScript
 * source.
 *
 * Builds a double-quoted literal with `JSON.stringify`, then escapes the
 * characters that are valid inside a JSON string yet unsafe inside JavaScript
 * source: the angle brackets that could otherwise break out of an enclosing
 * `</script>` and the U+2028/U+2029 line separators that prematurely terminate
 * a string literal. The escaped form parses back to the original value.
 */
export const quote = (value: string): string => JSON.stringify(value).replace(UNSAFE_SOURCE_CHARS, escapeSourceChar);

/**
 * Renders an array literal multi-line, indenting each element four spaces
 * and adding a trailing comma.
 *
 * Empty input renders as `[]`.
 *
 * @param elements - Already-rendered element expressions
 */
export const arrayLiteral = (elements: readonly string[]): string => {
    if (elements.length === 0) return "[]";
    const lines = elements.map((element) => `    ${element},`);
    return `[\n${lines.join("\n")}\n]`;
};
