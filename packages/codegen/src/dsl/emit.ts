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
 * Renders a brace-delimited block: `head`, a space, an opening brace, the
 * one-level-indented `body`, and a closing brace on its own line. The single
 * brace/indent formatter the writers route their member, accessor, case, and
 * constructor bodies through.
 *
 * @param head - The text preceding the opening brace (e.g. a method signature)
 * @param body - The multi-line block body, indented one level
 */
export const renderBlock = (head: string, body: string): string => `${head} {\n${indent(body, 1)}\n}`;

/**
 * Renders a headless brace-delimited block: an opening brace, the
 * one-level-indented `body`, and a closing brace on its own line. The
 * record-literal counterpart to {@link renderBlock} for object/struct values
 * that have no preceding signature.
 *
 * @param body - The multi-line block body, indented one level
 */
export const renderBraced = (body: string): string => `{\n${indent(body, 1)}\n}`;

/**
 * Renders {@link renderBlock}, collapsing to `${head} {}` when `body` is empty
 * so an interface or class with no members emits a single-line empty body
 * rather than a brace pair wrapping a blank line.
 *
 * @param head - The text preceding the opening brace
 * @param body - The multi-line block body, indented one level when present
 */
export const renderBracedOrEmpty = (head: string, body: string): string =>
    body.length === 0 ? `${head} {}` : renderBlock(head, body);

/**
 * Indents each member of `members` one level and joins them with a blank line,
 * producing the body of a class or interface without wrapping braces.
 *
 * @param members - The already-rendered member declarations
 */
export const indentMembers = (members: readonly string[]): string =>
    members.map((member) => indent(member, 1)).join("\n\n");

/**
 * Joins `parts` with commas, dropping `undefined` entries.
 */
export const joinArgs = (parts: ReadonlyArray<string | undefined>): string =>
    parts.filter((part): part is string => part !== undefined).join(", ");

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
