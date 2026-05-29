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

/**
 * Quotes a string for use in TypeScript source.
 *
 * Uses `JSON.stringify`, which produces double-quoted strings with all
 * necessary escapes.
 */
export const quote = (value: string): string => JSON.stringify(value);

/**
 * Renders an object literal where each key is a bare identifier and each
 * value is already a TypeScript expression string.
 *
 * Empty input renders as `{}`; populated input renders multiline with
 * 4-space indentation suitable for nesting.
 *
 * @param entries - Iterable of `[key, value]` pairs
 */
export const objectLiteral = (entries: ReadonlyArray<readonly [string, string]>): string => {
    if (entries.length === 0) return "{}";
    const lines = entries.map(([key, value]) => `    ${key}: ${value},`);
    return `{\n${lines.join("\n")}\n}`;
};

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
