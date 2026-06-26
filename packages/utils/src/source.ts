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

export const sanitizeIdentifier = (name: string): string => (RESERVED.has(name) ? `${name}_` : name);

export const toCamelIdentifier = (name: string): string => sanitizeIdentifier(toCamelCase(name));

const SOURCE_ESCAPES: Record<string, string> = {
    "<": "\\u003C",
    ">": "\\u003E",
    "\u2028": "\\u2028",
    "\u2029": "\\u2029",
};

const UNSAFE_SOURCE_CHARS = new RegExp(`[${Object.keys(SOURCE_ESCAPES).join("")}]`, "g");

export const sourceStringLiteral = (value: string): string =>
    JSON.stringify(value).replace(UNSAFE_SOURCE_CHARS, (char) => SOURCE_ESCAPES[char] ?? char);
