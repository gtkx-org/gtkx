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

export const toIdentifier = (name: string): string => (RESERVED.has(name) ? `${name}_` : name);

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

export const quote = (value: string): string => JSON.stringify(value).replace(UNSAFE_SOURCE_CHARS, escapeSourceChar);
