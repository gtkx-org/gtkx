/**
 * TypeScript/JavaScript naming utilities for code generation.
 *
 * These utilities convert GIR names to idiomatic TypeScript identifiers.
 */

const RESERVED_WORDS = new Set([
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
    "new",
    "null",
    "return",
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
    "let",
    "static",
    "enum",
    "implements",
    "interface",
    "package",
    "private",
    "protected",
    "public",
    "await",
    "async",
    "eval",
    "arguments",
]);

export const toCamelCase = (str: string): string => str.replace(/[-_]([a-z])/g, (_, letter) => letter.toUpperCase());

export const kebabToSnake = (str: string): string => str.replace(/-/g, "_");

export const snakeToKebab = (str: string): string => str.replace(/_/g, "-");

export const toPascalCase = (str: string): string => {
    const camel = toCamelCase(str);
    return camel.charAt(0).toUpperCase() + camel.slice(1);
};

export const toKebabCase = (str: string): string =>
    str
        .replace(/([a-z])([A-Z])/g, "$1-$2")
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
        .replace(/_/g, "-")
        .toLowerCase();

export const toConstantCase = (str: string): string => str.replace(/-/g, "_").toUpperCase();

export const toValidIdentifier = (str: string): string => {
    let result = str.replace(/[^a-zA-Z0-9_$]/g, "_");
    if (RESERVED_WORDS.has(result)) result = `${result}_`;
    if (/^\d/.test(result)) result = `_${result}`;
    return result;
};

export const CLASS_RENAMES = new Map<string, string>([["Error", "GError"]]);

export const normalizeClassName = (name: string, namespace?: string): string => {
    const pascalName = toPascalCase(name);
    if (CLASS_RENAMES.has(pascalName)) {
        return CLASS_RENAMES.get(pascalName) as string;
    }
    if (pascalName === "Object" && namespace) {
        return namespace === "GObject" ? "GObject" : `${namespace}Object`;
    }
    return pascalName;
};

export const generateConflictingMethodName = (prefix: string, methodName: string): string => {
    return toCamelCase(prefix) + toPascalCase(methodName);
};
