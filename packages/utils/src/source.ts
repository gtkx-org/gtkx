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
 * Returns the name unchanged, or with a trailing underscore when it collides with a reserved word,
 * so it is safe to emit as a JavaScript identifier.
 *
 * @param name The candidate identifier.
 */
export const sanitizeIdentifier = (name: string): string => (RESERVED.has(name) ? `${name}_` : name);

/**
 * Converts a name to camelCase and sanitizes it into a valid JavaScript identifier.
 *
 * @param name The name to convert.
 */
export const toCamelIdentifier = (name: string): string => sanitizeIdentifier(toCamelCase(name));

const SOURCE_ESCAPES: Record<string, string> = {
    "<": "\\u003C",
    ">": "\\u003E",
    "\u2028": "\\u2028",
    "\u2029": "\\u2029",
};

const UNSAFE_SOURCE_CHARS = new RegExp(`[${Object.keys(SOURCE_ESCAPES).join("")}]`, "g");

/**
 * Encodes a string as a JavaScript string literal, additionally escaping characters that are unsafe
 * to embed in generated source (angle brackets and the line and paragraph separators).
 *
 * @param value The string to encode.
 */
export const sourceStringLiteral = (value: string): string =>
    JSON.stringify(value).replace(UNSAFE_SOURCE_CHARS, (char) => SOURCE_ESCAPES[char] ?? char);
