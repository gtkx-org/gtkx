import { toCamelCase } from "./string.js";

const RESERVED: Set<string> = new Set([
    "arguments",
    "await",
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "debugger",
    "default",
    "delete",
    "do",
    "else",
    "enum",
    "eval",
    "export",
    "extends",
    "false",
    "finally",
    "for",
    "function",
    "if",
    "import",
    "in",
    "instanceof",
    "interface",
    "let",
    "new",
    "null",
    "package",
    "private",
    "protected",
    "public",
    "return",
    "static",
    "super",
    "switch",
    "this",
    "throw",
    "true",
    "try",
    "typeof",
    "var",
    "void",
    "while",
    "with",
    "yield",
]);

/**
 * Returns a name safe to emit as a TypeScript identifier, escaping reserved words.
 *
 * Reserved words are suffixed with an underscore so the emitted source parses;
 * any other name is returned unchanged.
 *
 * @param name - the candidate identifier
 * @returns the name, suffixed with `_` when it collides with a reserved word
 */
export const toIdentifier = (name: string): string => (RESERVED.has(name) ? `${name}_` : name);

/**
 * Converts a GIR name to a camelCase identifier safe to emit as source.
 *
 * Applies {@link toCamelCase} and then {@link toIdentifier}, so a name that
 * camelCases into a reserved word is also escaped.
 *
 * @param name - the GIR name to convert
 * @returns the camelCase identifier, escaped when it collides with a reserved word
 */
export const toCamelIdentifier = (name: string): string => toIdentifier(toCamelCase(name));

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
 * Returns a double-quoted string literal safe to splice into emitted TS/JSX source.
 *
 * Beyond `JSON.stringify`, two extra escape classes prevent a source-injection
 * or parse-breakage regression, so this must not be collapsed back to plain
 * `JSON.stringify`:
 *
 * - `<` and `>` are escaped so the quoted literal cannot interleave with the
 *   surrounding JSX tags or produce a literal `</...>` sequence when embedded
 *   in codegen-emitted source.
 * - U+2028 (line separator) and U+2029 (paragraph separator) are valid inside
 *   JSON but are JavaScript line terminators that break a string literal in
 *   pre-ES2019 parsers, so they are escaped to keep the output parseable.
 *
 * @param value - the raw string to quote
 * @returns a quoted, source-safe string literal
 */
export const quote = (value: string): string => JSON.stringify(value).replace(UNSAFE_SOURCE_CHARS, escapeSourceChar);
